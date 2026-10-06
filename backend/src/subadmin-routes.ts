import { Router, Response } from "express";

import {
  requireAuth,
  requireMainAdmin,
  AuthenticatedRequest,
} from "./auth-middleware.js";

import {
  adminAuth,
  adminDatabase,
} from "./firebase-admin.js";

const router = Router();


// =========================================================
// TYPES
// =========================================================

interface SubAdminPermissions {
  admissions?: boolean;
  students?: boolean;
  parents?: boolean;
  staff?: boolean;
  classes?: boolean;
  subjects?: boolean;
  teachingAssignments?: boolean;
  academics?: boolean;
  results?: boolean;
  attendance?: boolean;
  messages?: boolean;
  fees?: boolean;
  payments?: boolean;
  news?: boolean;
  events?: boolean;
  gallery?: boolean;
}

type SubAdminStatus = "active" | "inactive";

interface CreateSubAdminBody {
  subAdminId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  permissions?: SubAdminPermissions;
  status?: string;
}

interface UpdateSubAdminBody {
  fullName?: string;
  phone?: string;
  permissions?: SubAdminPermissions;
  status?: string;
}


// =========================================================
// VALID PERMISSION KEYS
// =========================================================

const VALID_PERMISSIONS: Array<
  keyof SubAdminPermissions
> = [
  "admissions",
  "students",
  "parents",
  "staff",
  "classes",
  "subjects",
  "teachingAssignments",
  "academics",
  "results",
  "attendance",
  "messages",
  "fees",
  "payments",
  "news",
  "events",
  "gallery",
];


// =========================================================
// DEFAULT PERMISSIONS
// =========================================================

function getDefaultPermissions(): SubAdminPermissions {
  return {
    admissions: true,
    students: true,
    parents: true,
    staff: false,
    classes: true,
    subjects: true,
    teachingAssignments: true,
    academics: true,
    results: true,
    attendance: true,
    messages: true,
    fees: true,
    payments: true,
    news: false,
    events: false,
    gallery: false,
  };
}


// =========================================================
// NORMALIZE PERMISSIONS
// =========================================================

function normalizePermissions(
  permissions?: SubAdminPermissions
): SubAdminPermissions {
  const defaults =
    getDefaultPermissions();

  if (!permissions) {
    return defaults;
  }

  const normalized: SubAdminPermissions = {
    ...defaults,
  };

  for (const key of VALID_PERMISSIONS) {
    if (
      permissions[key] !== undefined
    ) {
      normalized[key] =
        permissions[key] === true;
    }
  }

  return normalized;
}


// =========================================================
// GENERATE SUB ADMIN ID
// =========================================================

function generateSubAdminId(): string {
  const randomNumber =
    Math.floor(
      100000 +
        Math.random() * 900000
    );

  return `DL-SA-${randomNumber}`;
}


// =========================================================
// GENERATE TEMPORARY PASSWORD
// =========================================================

function generateTemporaryPassword(): string {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ" +
    "abcdefghijkmnopqrstuvwxyz" +
    "23456789";

  let password = "";

  for (let i = 0; i < 10; i++) {
    const index =
      Math.floor(
        Math.random() *
          characters.length
      );

    password +=
      characters[index];
  }

  return password;
}


// =========================================================
// GENERATE DEFAULT LOGIN EMAIL
// =========================================================

function createSubAdminEmail(
  subAdminId: string
): string {
  return (
    `${subAdminId.toLowerCase()}` +
    `@admin.dlittles.com`
  );
}


// =========================================================
// GET USER RECORD
// =========================================================

async function getUserRecord(
  uid: string
): Promise<any | null> {
  const snapshot =
    await adminDatabase
      .ref(`users/${uid}`)
      .once("value");

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val();
}


// =========================================================
// CHECK SUB ADMIN PERMISSION
// =========================================================

async function hasSubAdminPermission(
  uid: string,
  permission: keyof SubAdminPermissions
): Promise<boolean> {
  const userData =
    await getUserRecord(uid);

  if (!userData) {
    return false;
  }

  // =======================================================
  // MAIN ADMIN
  // =======================================================

  if (
    userData.role === "admin" &&
    userData.status !== "inactive"
  ) {
    return true;
  }

  // =======================================================
  // SUB ADMIN
  // =======================================================

  if (
    userData.role !== "subadmin"
  ) {
    return false;
  }

  if (
    userData.status === "inactive"
  ) {
    return false;
  }

  const subAdminSnapshot =
    await adminDatabase
      .ref(`subAdmins/${uid}`)
      .once("value");

  if (!subAdminSnapshot.exists()) {
    return false;
  }

  const subAdmin =
    subAdminSnapshot.val();

  if (
    subAdmin.status !== "active"
  ) {
    return false;
  }

  return (
    subAdmin.permissions?.[
      permission
    ] === true
  );
}


// =========================================================
// CREATE SUB ADMIN
// =========================================================
//
// POST /api/subadmins/create
//
// ONLY MAIN ADMIN
//
// =========================================================

router.post(
  "/create",
  requireAuth,
  requireMainAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    let createdAuthUser:
      Awaited<
        ReturnType<
          typeof adminAuth.createUser
        >
      > | null = null;

    try {
      // =====================================================
      // REQUEST BODY
      // =====================================================

      const body =
        req.body as CreateSubAdminBody;

      if (!body.fullName?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Sub Admin full name is required.",
        });
      }

      // =====================================================
      // SUB ADMIN ID
      // =====================================================

      let subAdminId =
        body.subAdminId?.trim();

      if (!subAdminId) {
        subAdminId =
          generateSubAdminId();
      }

      subAdminId =
        subAdminId.toUpperCase();

      // =====================================================
      // CHECK SUB ADMIN ID
      // =====================================================

      const existingSubAdmin =
        await adminDatabase
          .ref("subAdmins")
          .orderByChild("subAdminId")
          .equalTo(subAdminId)
          .once("value");

      if (existingSubAdmin.exists()) {
        return res.status(409).json({
          success: false,
          message:
            `Sub Admin ID ${subAdminId} already exists.`,
        });
      }

      // =====================================================
      // EMAIL
      // =====================================================

      const loginEmail =
        body.email?.trim()
          ? body.email
              .trim()
              .toLowerCase()
          : createSubAdminEmail(
              subAdminId
            );

      // =====================================================
      // CHECK EMAIL
      // =====================================================

      try {
        await adminAuth.getUserByEmail(
          loginEmail
        );

        return res.status(409).json({
          success: false,
          message:
            `An account already exists for ${loginEmail}.`,
        });
      } catch (error: any) {
        if (
          error?.code !==
          "auth/user-not-found"
        ) {
          throw error;
        }
      }

      // =====================================================
      // PASSWORD
      // =====================================================

      const temporaryPassword =
        generateTemporaryPassword();

      // =====================================================
      // CREATE FIREBASE AUTH ACCOUNT
      // =====================================================

      createdAuthUser =
        await adminAuth.createUser({
          email:
            loginEmail,

          password:
            temporaryPassword,

          displayName:
            body.fullName.trim(),

          disabled:
            false,
        });

      // =====================================================
      // PERMISSIONS
      // =====================================================

      const permissions =
        normalizePermissions(
          body.permissions
        );

      // =====================================================
      // STATUS
      // =====================================================

      const status: SubAdminStatus =
        body.status === "inactive"
          ? "inactive"
          : "active";

      // =====================================================
      // TIMESTAMP
      // =====================================================

      const now =
        Date.now();

      // =====================================================
      // SUB ADMIN RECORD
      // =====================================================

      const subAdminData = {
        uid:
          createdAuthUser.uid,

        subAdminId,

        fullName:
          body.fullName.trim(),

        email:
          loginEmail,

        phone:
          body.phone?.trim() || "",

        role:
          "subadmin",

        status,

        permissions,

        createdAt:
          now,

        updatedAt:
          now,
      };

      // =====================================================
      // USERS RECORD
      // =====================================================

      const userData = {
        uid:
          createdAuthUser.uid,

        fullName:
          body.fullName.trim(),

        email:
          loginEmail,

        role:
          "subadmin",

        subAdminId,

        phone:
          body.phone?.trim() || "",

        status,

        createdAt:
          now,

        updatedAt:
          now,
      };

      // =====================================================
      // SAVE BOTH RECORDS
      // =====================================================

      await adminDatabase
        .ref()
        .update({
          [`users/${createdAuthUser.uid}`]:
            userData,

          [`subAdmins/${createdAuthUser.uid}`]:
            subAdminData,
        });

      // =====================================================
      // SUCCESS
      // =====================================================

      return res.status(201).json({
        success: true,

        message:
          "Sub Admin account created successfully.",

        subAdmin: {
          uid:
            createdAuthUser.uid,

          subAdminId,

          fullName:
            body.fullName.trim(),

          email:
            loginEmail,

          phone:
            body.phone?.trim() || "",

          role:
            "subadmin",

          status,

          permissions,
        },

        credentials: {
          uid:
            createdAuthUser.uid,

          subAdminId,

          email:
            loginEmail,

          temporaryPassword,
        },
      });

    } catch (error: any) {
      console.error(
        "Create Sub Admin error:",
        error
      );

      // =====================================================
      // CLEANUP AUTH ACCOUNT
      // =====================================================

      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(
            createdAuthUser.uid
          );
        } catch (cleanupError) {
          console.error(
            "Failed to clean up Sub Admin Auth account:",
            cleanupError
          );
        }
      }

      return res.status(500).json({
        success: false,

        message:
          "Unable to create Sub Admin account.",

        error:
          error?.message ||
          "Unknown server error.",
      });
    }
  }
);


// =========================================================
// LIST SUB ADMINS
// =========================================================
//
// GET /api/subadmins
//
// ONLY MAIN ADMIN
//
// =========================================================

router.get(
  "/",
  requireAuth,
  requireMainAdmin,
  async (
    _req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const snapshot =
        await adminDatabase
          .ref("subAdmins")
          .once("value");

      const data =
        snapshot.val() || {};

      const subAdmins =
        Object.values(data);

      return res.json({
        success: true,
        subAdmins,
      });

    } catch (error: any) {
      console.error(
        "Get Sub Admins error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load Sub Admin accounts.",
      });
    }
  }
);


// =========================================================
// CURRENT USER PERMISSION
// =========================================================
//
// GET /api/subadmins/me/permission/:permission
//
// =========================================================

router.get(
  "/me/permission/:permission",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const permission =
        String(
          req.params.permission
        ) as keyof SubAdminPermissions;

      // =====================================================
      // VALID PERMISSION
      // =====================================================

      if (
        !VALID_PERMISSIONS.includes(
          permission
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid permission.",
        });
      }

      // =====================================================
      // CHECK PERMISSION
      // =====================================================

      const allowed =
        await hasSubAdminPermission(
          uid,
          permission
        );

      return res.json({
        success: true,

        permission,

        allowed,
      });

    } catch (error: any) {
      console.error(
        "Permission check error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to check permission.",
      });
    }
  }
);


// =========================================================
// GET SINGLE SUB ADMIN
// =========================================================
//
// GET /api/subadmins/:uid
//
// ONLY MAIN ADMIN
//
// =========================================================

router.get(
  "/:uid",
  requireAuth,
  requireMainAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const uid =
        String(req.params.uid);

      const snapshot =
        await adminDatabase
          .ref(`subAdmins/${uid}`)
          .once("value");

      if (!snapshot.exists()) {
        return res.status(404).json({
          success: false,
          message:
            "Sub Admin account not found.",
        });
      }

      return res.json({
        success: true,

        subAdmin:
          snapshot.val(),
      });

    } catch (error: any) {
      console.error(
        "Get Sub Admin error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load Sub Admin account.",
      });
    }
  }
);


// =========================================================
// UPDATE SUB ADMIN
// =========================================================
//
// PUT /api/subadmins/:uid
//
// ONLY MAIN ADMIN
//
// Used for:
//
//   1. Editing Sub Admin details
//   2. Disabling a Sub Admin
//   3. Reactivating a Sub Admin
//
// =========================================================

router.put(
  "/:uid",
  requireAuth,
  requireMainAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const uid =
        String(req.params.uid);

      // =====================================================
      // GET EXISTING SUB ADMIN
      // =====================================================

      const existingSnapshot =
        await adminDatabase
          .ref(`subAdmins/${uid}`)
          .once("value");

      if (!existingSnapshot.exists()) {
        return res.status(404).json({
          success: false,
          message:
            "Sub Admin account not found.",
        });
      }

      const existing =
        existingSnapshot.val();

      // =====================================================
      // REQUEST BODY
      // =====================================================

      const body =
        req.body as UpdateSubAdminBody;

      // =====================================================
      // VALIDATE FULL NAME
      // =====================================================

      if (
        body.fullName !== undefined &&
        !body.fullName.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Sub Admin full name cannot be empty.",
        });
      }

      // =====================================================
      // PERMISSIONS
      // =====================================================

      const updatedPermissions =
        body.permissions
          ? {
              ...getDefaultPermissions(),
              ...(existing.permissions || {}),
              ...normalizePermissions(
                body.permissions
              ),
            }
          : {
              ...getDefaultPermissions(),
              ...(existing.permissions || {}),
            };

      // =====================================================
      // STATUS
      // =====================================================
      //
      // If status is omitted, preserve the
      // existing status.
      //
      // =====================================================

      let status: SubAdminStatus;

      if (
        body.status === "inactive"
      ) {
        status = "inactive";
      } else if (
        body.status === "active"
      ) {
        status = "active";
      } else {
        status =
          existing.status === "inactive"
            ? "inactive"
            : "active";
      }

      // =====================================================
      // TIMESTAMP
      // =====================================================

      const now =
        Date.now();

      // =====================================================
      // SUB ADMIN UPDATES
      // =====================================================

      const updates: Record<
        string,
        any
      > = {
        updatedAt:
          now,

        status,

        permissions:
          updatedPermissions,
      };

      if (
        body.fullName !== undefined
      ) {
        updates.fullName =
          body.fullName.trim();
      }

      if (
        body.phone !== undefined
      ) {
        updates.phone =
          body.phone.trim();
      }

      await adminDatabase
        .ref(`subAdmins/${uid}`)
        .update(updates);

      // =====================================================
      // USERS RECORD UPDATE
      // =====================================================

      const userUpdates: Record<
        string,
        any
      > = {
        status,
        updatedAt:
          now,
      };

      if (
        body.fullName !== undefined
      ) {
        userUpdates.fullName =
          body.fullName.trim();
      }

      if (
        body.phone !== undefined
      ) {
        userUpdates.phone =
          body.phone.trim();
      }

      await adminDatabase
        .ref(`users/${uid}`)
        .update(userUpdates);

      // =====================================================
      // KEEP FIREBASE AUTH ACCOUNT IN SYNC
      // =====================================================

      const authUpdates: {
        displayName?: string;
        disabled?: boolean;
      } = {
        disabled:
          status === "inactive",
      };

      if (
        body.fullName !== undefined
      ) {
        authUpdates.displayName =
          body.fullName.trim();
      }

      await adminAuth.updateUser(
        uid,
        authUpdates
      );

      // =====================================================
      // RETURN UPDATED RECORD
      // =====================================================

      const updatedSnapshot =
        await adminDatabase
          .ref(`subAdmins/${uid}`)
          .once("value");

      return res.json({
        success: true,

        message:
          status === "inactive"
            ? "Sub Admin account disabled successfully."
            : "Sub Admin account updated successfully.",

        subAdmin:
          updatedSnapshot.val(),
      });

    } catch (error: any) {
      console.error(
        "Update Sub Admin error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update Sub Admin account.",
        error:
          error?.message ||
          "Unknown server error.",
      });
    }
  }
);


// =========================================================
// PERMANENTLY DELETE SUB ADMIN
// =========================================================
//
// DELETE /api/subadmins/:uid
//
// ONLY MAIN ADMIN
//
// THIS IS A REAL DELETE.
//
// It permanently removes:
//
//   1. Firebase Authentication account
//   2. users/{uid}
//   3. subAdmins/{uid}
//
// Unlike the PUT endpoint, this endpoint does NOT
// simply change the account status to inactive.
//
// =========================================================

router.delete(
  "/:uid",
  requireAuth,
  requireMainAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const uid =
        String(req.params.uid).trim();

      // =====================================================
      // VALIDATE UID
      // =====================================================

      if (!uid) {
        return res.status(400).json({
          success: false,
          message:
            "Sub Admin UID is required.",
        });
      }

      // =====================================================
      // GET SUB ADMIN RECORD
      // =====================================================

      const snapshot =
        await adminDatabase
          .ref(`subAdmins/${uid}`)
          .once("value");

      if (!snapshot.exists()) {
        return res.status(404).json({
          success: false,
          message:
            "Sub Admin account not found.",
        });
      }

      const subAdmin =
        snapshot.val();

      // =====================================================
      // SAFETY CHECK
      // =====================================================
      //
      // Never allow this endpoint to delete a record
      // that is not actually a sub-admin.
      //
      // =====================================================

      if (
        subAdmin.role !== "subadmin"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The selected account is not a Sub Admin account.",
        });
      }

      // =====================================================
      // DELETE FIREBASE AUTH ACCOUNT
      // =====================================================
      //
      // Delete the Authentication account first.
      //
      // =====================================================

      try {
        await adminAuth.deleteUser(
          uid
        );
      } catch (authError: any) {

        // ===================================================
        // AUTH ACCOUNT ALREADY DOES NOT EXIST
        // ===================================================

        if (
          authError?.code !==
          "auth/user-not-found"
        ) {
          throw authError;
        }

        console.warn(
          `Firebase Auth user ${uid} was already missing. Continuing with database cleanup.`
        );
      }

      // =====================================================
      // DELETE BOTH DATABASE RECORDS
      // =====================================================
      //
      // Use one multi-location update so that both records
      // are removed together.
      //
      // =====================================================

      await adminDatabase
        .ref()
        .update({
          [`subAdmins/${uid}`]:
            null,

          [`users/${uid}`]:
            null,
        });

      // =====================================================
      // SUCCESS
      // =====================================================

      return res.json({
        success: true,

        message:
          "Sub Admin account permanently deleted successfully.",

        uid,
      });

    } catch (error: any) {
      console.error(
        "Delete Sub Admin error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to permanently delete Sub Admin account.",

        error:
          error?.message ||
          "Unknown server error.",
      });
    }
  }
);


export default router;
