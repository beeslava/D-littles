import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  adminAuth,
  adminDatabase,
} from "./firebase-admin.js";


// =========================================================
// AUTHENTICATED REQUEST
// =========================================================

export interface AuthenticatedRequest
  extends Request {

  user?: {
    uid: string;
    email?: string;
  };

}


// =========================================================
// ADMIN PERMISSIONS
// =========================================================
//
// These must match the permissions used by the
// Sub Admin system.
//
// NOTE:
// "dashboard" is intentionally not included here.
// All active administrators can access the dashboard.
// =========================================================

export type AdminPermission =
  | "admissions"
  | "students"
  | "parents"
  | "staff"
  | "classes"
  | "subjects"
  | "teachingAssignments"
  | "academics"
  | "results"
  | "attendance"
  | "messages"
  | "fees"
  | "payments"
  | "news"
  | "events"
  | "gallery";


// =========================================================
// REQUIRE FIREBASE AUTHENTICATION
// =========================================================
//
// Verifies the Firebase ID token sent as:
//
// Authorization: Bearer <firebase-id-token>
//
// If valid:
// req.user.uid
// req.user.email
//
// become available to downstream middleware/routes.
// =========================================================

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {

  try {

    const authorization =
      req.headers.authorization;


    // -----------------------------------------------------
    // AUTHORIZATION HEADER
    // -----------------------------------------------------

    if (!authorization) {

      res.status(401).json({

        success: false,

        message:
          "Authorization token is required.",

      });

      return;
    }


    // -----------------------------------------------------
    // BEARER FORMAT
    // -----------------------------------------------------

    if (
      !authorization.startsWith("Bearer ")
    ) {

      res.status(401).json({

        success: false,

        message:
          "Invalid authorization format.",

      });

      return;
    }


    // -----------------------------------------------------
    // EXTRACT TOKEN
    // -----------------------------------------------------

    const idToken =
      authorization
        .substring(7)
        .trim();


    if (!idToken) {

      res.status(401).json({

        success: false,

        message:
          "Firebase ID token is missing.",

      });

      return;
    }


    // -----------------------------------------------------
    // VERIFY FIREBASE TOKEN
    // -----------------------------------------------------

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );


    // -----------------------------------------------------
    // ATTACH USER
    // -----------------------------------------------------

    req.user = {

      uid:
        decodedToken.uid,

      email:
        decodedToken.email,

    };


    next();

  } catch (error) {

    console.error(
      "Authentication error:",
      error
    );


    res.status(401).json({

      success: false,

      message:
        "Invalid or expired Firebase token.",

    });

  }

}


// =========================================================
// GET CURRENT ADMIN USER RECORD
// =========================================================
//
// Reads the current administrator from:
//
// users/{uid}
//
// This is intentionally loaded from RTDB instead of
// trusting Firebase custom claims because your current
// Sub Admin system stores role/status there.
// =========================================================

async function getAdminUserRecord(
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
// REQUIRE ADMIN OR ACTIVE SUB ADMIN
// =========================================================
//
// This verifies that the authenticated Firebase user
// is actually an active administrator.
//
// Main Admin:
//     role === "admin"
//     status !== "inactive"
//
// Sub Admin:
//     role === "subadmin"
//     status === "active"
// =========================================================

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {

  try {

    const uid =
      req.user?.uid;


    if (!uid) {

      res.status(401).json({

        success: false,

        message:
          "Authentication required.",

      });

      return;
    }


    const userData =
      await getAdminUserRecord(uid);


    if (!userData) {

      res.status(403).json({

        success: false,

        message:
          "Administrator account not found.",

      });

      return;
    }


    // -----------------------------------------------------
    // MAIN ADMIN
    // -----------------------------------------------------

    if (
      userData.role === "admin" &&
      userData.status !== "inactive"
    ) {

      next();

      return;
    }


    // -----------------------------------------------------
    // ACTIVE SUB ADMIN
    // -----------------------------------------------------

    if (
      userData.role === "subadmin" &&
      userData.status === "active"
    ) {

      next();

      return;
    }


    // -----------------------------------------------------
    // NOT AN ACTIVE ADMINISTRATOR
    // -----------------------------------------------------

    res.status(403).json({

      success: false,

      message:
        "Administrator access is required.",

    });

  } catch (error) {

    console.error(
      "Admin authorization error:",
      error
    );


    res.status(500).json({

      success: false,

      message:
        "Unable to verify administrator access.",

    });

  }

}


// =========================================================
// ADMIN PERMISSION MIDDLEWARE
// =========================================================
//
// Usage:
//
// router.get(
//   "/",
//   requireAuth,
//   requireAdminPermission("students"),
//   async (...) => {
//      ...
//   }
// );
//
// Main Admin:
//     Automatically allowed.
//
// Active Sub Admin:
//     Must have the requested permission.
//
// Everyone else:
//     Denied.
//
// =========================================================

export function requireAdminPermission(
  permission: AdminPermission
) {

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    try {

      const uid =
        req.user?.uid;


      if (!uid) {

        res.status(401).json({

          success: false,

          message:
            "Authentication required.",

        });

        return;
      }


      // ---------------------------------------------------
      // LOAD USER RECORD
      // ---------------------------------------------------

      const userData =
        await getAdminUserRecord(uid);


      if (!userData) {

        res.status(403).json({

          success: false,

          message:
            "Administrator account not found.",

        });

        return;
      }


      // ---------------------------------------------------
      // MAIN ADMIN
      // ---------------------------------------------------
      //
      // Main Admin bypasses individual permission checks.
      //

      if (
        userData.role === "admin" &&
        userData.status !== "inactive"
      ) {

        next();

        return;
      }


      // ---------------------------------------------------
      // SUB ADMIN
      // ---------------------------------------------------

      if (
        userData.role !== "subadmin" ||
        userData.status !== "active"
      ) {

        res.status(403).json({

          success: false,

          message:
            "Administrator access is required.",

        });

        return;
      }


      // ---------------------------------------------------
      // LOAD SUB ADMIN RECORD
      // ---------------------------------------------------

      const subAdminSnapshot =
        await adminDatabase
          .ref(`subAdmins/${uid}`)
          .once("value");


      if (!subAdminSnapshot.exists()) {

        res.status(403).json({

          success: false,

          message:
            "Sub Admin account could not be found.",

        });

        return;
      }


      const subAdmin =
        subAdminSnapshot.val();


      // ---------------------------------------------------
      // SUB ADMIN STATUS
      // ---------------------------------------------------

      if (
        subAdmin.status !== "active"
      ) {

        res.status(403).json({

          success: false,

          message:
            "Your Sub Admin account is inactive.",

        });

        return;
      }


      // ---------------------------------------------------
      // PERMISSION CHECK
      // ---------------------------------------------------

      const hasPermission =
        subAdmin.permissions?.[permission] === true;


      if (!hasPermission) {

        console.warn(
          `Permission denied: ${uid} attempted ${permission}`
        );


        res.status(403).json({

          success: false,

          message:
            `You do not have permission to access ${permission}.`,

          permission,

        });

        return;
      }


      // ---------------------------------------------------
      // ALLOWED
      // ---------------------------------------------------

      next();

    } catch (error) {

      console.error(
        `Permission check error (${permission}):`,
        error
      );


      res.status(500).json({

        success: false,

        message:
          "Unable to verify administrator permission.",

      });

    }

  };

}


// =========================================================
// MAIN ADMIN ONLY MIDDLEWARE
// =========================================================
//
// Use this for:
//
// - Sub Admin management
// - Creating Sub Admins
// - Editing Sub Admins
// - Disabling Sub Admins
//
// =========================================================

export async function requireMainAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {

  try {

    const uid =
      req.user?.uid;


    if (!uid) {

      res.status(401).json({

        success: false,

        message:
          "Authentication required.",

      });

      return;
    }


    const userData =
      await getAdminUserRecord(uid);


    if (
      userData?.role === "admin" &&
      userData?.status !== "inactive"
    ) {

      next();

      return;
    }


    res.status(403).json({

      success: false,

      message:
        "Only the main administrator can perform this action.",

    });

  } catch (error) {

    console.error(
      "Main Admin authorization error:",
      error
    );


    res.status(500).json({

      success: false,

      message:
        "Unable to verify Main Admin access.",

    });

  }

}