import { Router, Response } from "express";

import {
  requireAuth,
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

    password += characters[index];
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
// VERIFY MAIN ADMIN
// =========================================================

async function verifyMainAdmin(
  req: AuthenticatedRequest
): Promise<boolean> {

  const uid =
    req.user?.uid;

  if (!uid) {
    return false;
  }

  const userData =
    await getUserRecord(uid);

  return (
    userData?.role === "admin" &&
    userData?.status !== "inactive"
  );
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

  // Main admin automatically has every permission.
  if (
    userData.role === "admin" &&
    userData.status !== "inactive"
  ) {
    return true;
  }

  if (
    userData.role !== "subadmin"
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
    subAdmin.permissions?.[permission] === true
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
      // MAIN ADMIN CHECK
      // =====================================================

      const isAdmin =
        await verifyMainAdmin(req);

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message:
            "Only the main administrator can create Sub Admin accounts.",
        });
      }


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
          ? body.email.trim().toLowerCase()
          : createSubAdminEmail(subAdminId);


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
          email: loginEmail,
          password: temporaryPassword,
          displayName: body.fullName.trim(),
          disabled: false,
        });


      // =====================================================
      // PERMISSIONS
      // =====================================================

      const permissions: SubAdminPermissions = {
        ...getDefaultPermissions(),
        ...(body.permissions || {}),
      };


      // =====================================================
      // STATUS
      // =====================================================

      const status =
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

          status,

          permissions,

        },

        credentials: {

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
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const isAdmin =
        await verifyMainAdmin(req);

      if (!isAdmin) {

        return res.status(403).json({

          success: false,

          message:
            "Only the main administrator can view Sub Admin accounts.",

        });

      }


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
// IMPORTANT:
//
// This route MUST come before /:uid.
//
// Otherwise:
// /me/permission/students
//
// could be interpreted as:
// /:uid
//
// with uid = "me".
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


      // IMPORTANT FIX:
      // Express can type route params as string | string[].
      const permission =
        String(req.params.permission) as keyof SubAdminPermissions;


      const validPermissions =
        Object.keys(
          getDefaultPermissions()
        );


      if (
        !validPermissions.includes(
          permission
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid permission.",

        });

      }


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
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const isAdmin =
        await verifyMainAdmin(req);

      if (!isAdmin) {

        return res.status(403).json({

          success: false,

          message:
            "Only the main administrator can view Sub Admin accounts.",

        });

      }


      // IMPORTANT FIX
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
// =========================================================

router.put(
  "/:uid",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const isAdmin =
        await verifyMainAdmin(req);

      if (!isAdmin) {

        return res.status(403).json({

          success: false,

          message:
            "Only the main administrator can update Sub Admin accounts.",

        });

      }


      // IMPORTANT FIX
      const uid =
        String(req.params.uid);


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


      const body =
        req.body as UpdateSubAdminBody;


      const existing =
        existingSnapshot.val();


      const updatedPermissions =
        body.permissions
          ? {
              ...getDefaultPermissions(),
              ...existing.permissions,
              ...body.permissions,
            }
          : existing.permissions;


      const status =
        body.status === "inactive"
          ? "inactive"
          : "active";


      const now =
        Date.now();


      const updates: Record<string, any> = {

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


      await adminDatabase
        .ref(`users/${uid}`)
        .update({

          ...(body.fullName !== undefined
            ? {
                fullName:
                  body.fullName.trim(),
              }
            : {}),

          ...(body.phone !== undefined
            ? {
                phone:
                  body.phone.trim(),
              }
            : {}),

          status,

          updatedAt:
            now,

        });


      // =====================================================
      // KEEP FIREBASE AUTH ACCOUNT IN SYNC
      // =====================================================

      await adminAuth.updateUser(
        uid,
        {

          displayName:
            body.fullName !== undefined
              ? body.fullName.trim()
              : existing.fullName,

          disabled:
            status === "inactive",

        }
      );


      return res.json({

        success: true,

        message:
          "Sub Admin account updated successfully.",

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

      });

    }

  }
);


// =========================================================
// DISABLE SUB ADMIN
// =========================================================
//
// DELETE /api/subadmins/:uid
//
// We disable rather than permanently delete.
//
// =========================================================

router.delete(
  "/:uid",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const isAdmin =
        await verifyMainAdmin(req);

      if (!isAdmin) {

        return res.status(403).json({

          success: false,

          message:
            "Only the main administrator can disable Sub Admin accounts.",

        });

      }


      // IMPORTANT FIX
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


      const now =
        Date.now();


      await adminDatabase
        .ref(`subAdmins/${uid}`)
        .update({

          status:
            "inactive",

          updatedAt:
            now,

        });


      await adminDatabase
        .ref(`users/${uid}`)
        .update({

          status:
            "inactive",

          updatedAt:
            now,

        });


      await adminAuth.updateUser(
        uid,
        {

          disabled:
            true,

        }
      );


      return res.json({

        success: true,

        message:
          "Sub Admin account disabled successfully.",

      });

    } catch (error: any) {

      console.error(
        "Disable Sub Admin error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Unable to disable Sub Admin account.",

      });

    }

  }
);


export default router;