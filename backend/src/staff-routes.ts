import { Router, Response } from "express";

import {
  requireAuth,
  requireAdminPermission,
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

interface CreateStaffBody {
  staffId?: string;

  fullName: string;

  email?: string;

  phone?: string;

  gender?: string;

  position?: string;

  department?: string;

  qualification?: string;

  employmentDate?: string;

  address?: string;

  emergencyContact?: string;

  status?: string;
}

// =========================================================
// GENERATE STAFF ID
// =========================================================

function generateStaffId(): string {
  const randomNumber =
    Math.floor(
      100000 +
      Math.random() * 900000
    );

  return `DL-ST-${randomNumber}`;
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
// GENERATE STAFF LOGIN EMAIL
// =========================================================

function createStaffEmail(
  staffId: string
): string {
  return (
    `${staffId.toLowerCase()}` +
    `@staff.dlittles.com`
  );
}

// =========================================================
// CREATE STAFF ACCOUNT
// =========================================================
//
// POST /api/staff/create
//
// Authorization:
// Bearer <firebase-id-token>
//
// Required permission:
//
// Main Admin:
//   Automatically allowed.
//
// Sub Admin:
//   Requires:
//   subAdmins/{uid}/permissions/staff === true
//
// =========================================================

router.post(
  "/create",
  requireAuth,
  requireAdminPermission("staff"),
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
      // REQUEST DATA
      // =====================================================

      const body =
        req.body as CreateStaffBody;

      if (!body.fullName?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Staff full name is required.",
        });
      }

      // =====================================================
      // STAFF ID
      // =====================================================

      let staffId =
        body.staffId?.trim();

      if (!staffId) {
        staffId =
          generateStaffId();
      }

      staffId =
        staffId.toUpperCase();

      // =====================================================
      // CHECK STAFF ID
      // =====================================================

      const existingStaff =
        await adminDatabase
          .ref("staff")
          .orderByChild("staffId")
          .equalTo(staffId)
          .once("value");

      if (existingStaff.exists()) {
        return res.status(409).json({
          success: false,
          message:
            `Staff ID ${staffId} already exists.`,
        });
      }

      // =====================================================
      // STAFF EMAIL
      // =====================================================

      const loginEmail =
        body.email?.trim()
          ? body.email.trim().toLowerCase()
          : createStaffEmail(staffId);

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
      // TEMPORARY PASSWORD
      // =====================================================

      const temporaryPassword =
        generateTemporaryPassword();

      // =====================================================
      // CREATE FIREBASE AUTH USER
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
      // CREATE STAFF DATABASE RECORD
      // =====================================================

      const staffRef =
        adminDatabase
          .ref("staff")
          .push();

      const staffRecordId =
        staffRef.key;

      if (!staffRecordId) {
        throw new Error(
          "Unable to generate staff record ID."
        );
      }

      // =====================================================
      // TIMESTAMP
      // =====================================================

      const now =
        Date.now();

      // =====================================================
      // STAFF RECORD
      // =====================================================

      const staffData = {
        id:
          staffRecordId,

        staffId,

        uid:
          createdAuthUser.uid,

        fullName:
          body.fullName.trim(),

        email:
          loginEmail,

        phone:
          body.phone?.trim() || "",

        gender:
          body.gender?.trim() || "",

        position:
          body.position?.trim() || "",

        department:
          body.department?.trim() || "",

        qualification:
          body.qualification?.trim() || "",

        employmentDate:
          body.employmentDate?.trim() || "",

        address:
          body.address?.trim() || "",

        emergencyContact:
          body.emergencyContact?.trim() || "",

        status:
          body.status === "inactive"
            ? "inactive"
            : "active",

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
          "staff",

        staffId,

        status:
          body.status === "inactive"
            ? "inactive"
            : "active",

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
          [`staff/${staffRecordId}`]:
            staffData,

          [`users/${createdAuthUser.uid}`]:
            userData,
        });

      // =====================================================
      // SUCCESS RESPONSE
      // =====================================================

      return res.status(201).json({
        success: true,

        message:
          "Staff account created successfully.",

        staff: {
          id:
            staffRecordId,

          staffId,

          uid:
            createdAuthUser.uid,

          fullName:
            body.fullName.trim(),

          email:
            loginEmail,

          position:
            body.position?.trim() || "",

          department:
            body.department?.trim() || "",

          status:
            staffData.status,
        },

        credentials: {
          staffId,

          email:
            loginEmail,

          temporaryPassword,
        },
      });

    } catch (error: any) {
      console.error(
        "Create staff error:",
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
            "Failed to clean up Auth account:",
            cleanupError
          );
        }
      }

      // =====================================================
      // ERROR RESPONSE
      // =====================================================

      return res.status(500).json({
        success: false,

        message:
          "Unable to create staff account.",

        error:
          error?.message ||
          "Unknown server error.",
      });
    }
  }
);

export default router;