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

interface AdmissionData {
  applicationId?: string;

  status?: string;

  student?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    classApplied?: string;
  };

  parentGuardian?: {
    name?: string;
    phone?: string;
    email?: string;
    relationship?: string;
  };

  emergencyContact?: {
    name?: string;
    phone?: string;
  };

  additionalNotes?: string;
}


interface FirebaseRecord {
  [key: string]: unknown;
}


// =========================================================
// HELPERS
// =========================================================

async function generateSequentialId(
  recordsPath: string,
  counterPath: string,
  prefix: string,
  fieldName: string
): Promise<string> {

  const counterRef =
    adminDatabase.ref(counterPath);


  const counterSnapshot =
    await counterRef.once("value");


  let highestExistingNumber = 0;


  if (!counterSnapshot.exists()) {

    const recordsSnapshot =
      await adminDatabase
        .ref(recordsPath)
        .once("value");


    if (recordsSnapshot.exists()) {

      const records =
        recordsSnapshot.val() as Record<
          string,
          FirebaseRecord
        >;


      Object.values(records).forEach(
        (value: FirebaseRecord) => {

          const existingId =
            String(
              value[fieldName] || ""
            );


          const match =
            existingId.match(
              new RegExp(
                `^${prefix}-(\\d+)$`
              )
            );


          if (match) {

            const number =
              Number(match[1]);


            if (
              Number.isInteger(number) &&
              number > highestExistingNumber
            ) {

              highestExistingNumber =
                number;

            }

          }

        }
      );

    }

  }


  const transactionResult =
    await counterRef.transaction(
      (currentValue: unknown) => {

        if (
          typeof currentValue !== "number" ||
          !Number.isFinite(currentValue) ||
          currentValue < 1
        ) {

          return (
            highestExistingNumber + 2
          );

        }


        return (
          Math.floor(currentValue) + 1
        );

      }
    );


  if (!transactionResult.committed) {

    throw new Error(
      `Unable to generate a unique ${prefix} ID.`
    );

  }


  const counterValue =
    Number(
      transactionResult.snapshot.val()
    );


  if (
    !Number.isInteger(counterValue) ||
    counterValue < 2
  ) {

    throw new Error(
      `Invalid ${prefix} counter value.`
    );

  }


  const generatedNumber =
    counterValue - 1;


  return (
    `${prefix}-${String(generatedNumber).padStart(6, "0")}`
  );

}


async function generateStudentId(): Promise<string> {

  return generateSequentialId(
    "students",
    "counters/students/nextNumber",
    "DL-S",
    "studentId"
  );

}


async function generateParentId(): Promise<string> {

  return generateSequentialId(
    "parents",
    "counters/parents/nextNumber",
    "DL-P",
    "parentId"
  );

}


function normalizePhone(
  phone: string
): string {

  let value =
    String(phone || "")
      .trim()
      .replace(
        /[\s\-().]/g,
        ""
      );


  if (
    value.startsWith("0") &&
    value.length === 11
  ) {

    value =
      "234" +
      value.substring(1);

  }


  if (value.startsWith("+")) {

    value =
      value.substring(1);

  }


  return value;

}


function normalizeEmail(
  email: string
): string {

  return String(email || "")
    .trim()
    .toLowerCase();

}


function generateTemporaryPassword(): string {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";


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
// ERROR STATUS HELPER
// =========================================================

function getHttpStatus(
  error: unknown
): number {

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {

    const code =
      String(
        (error as { code: unknown }).code
      );


    if (
      code.includes("already-exists")
    ) {
      return 409;
    }


    if (
      code.includes("not-found")
    ) {
      return 404;
    }


    if (
      code.includes("permission-denied")
    ) {
      return 403;
    }


    if (
      code.includes("unauthenticated")
    ) {
      return 401;
    }


    if (
      code.includes("invalid-argument")
    ) {
      return 400;
    }


    if (
      code.includes("failed-precondition")
    ) {
      return 412;
    }

  }


  return 500;

}


// =========================================================
// APPROVE ADMISSION
// =========================================================
//
// POST
// /api/admissions/approve
//
// Header:
//
// Authorization: Bearer <Firebase ID Token>
//
// Body:
//
// {
//   "applicationId": "..."
//
// }
// =========================================================

router.post(
  "/approve",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      // ---------------------------------------------------
      // CHECK AUTHENTICATED USER
      // ---------------------------------------------------

      const adminUid =
        req.user?.uid;


      if (!adminUid) {

        return res.status(401).json({

          success: false,

          message:
            "Authentication is required.",

        });

      }


      // ---------------------------------------------------
      // CHECK ADMIN ROLE
      // ---------------------------------------------------

      const adminSnapshot =
        await adminDatabase
          .ref(`users/${adminUid}`)
          .once("value");


      if (!adminSnapshot.exists()) {

        return res.status(403).json({

          success: false,

          message:
            "Admin account was not found.",

        });

      }


      const adminUser =
        adminSnapshot.val() as FirebaseRecord;


      if (
        adminUser.role !== "admin"
      ) {

        return res.status(403).json({

          success: false,

          message:
            "Only administrators can approve admission applications.",

        });

      }


      // ---------------------------------------------------
      // GET APPLICATION ID
      // ---------------------------------------------------

      const applicationId =
        String(
          req.body?.applicationId || ""
        ).trim();


      if (!applicationId) {

        return res.status(400).json({

          success: false,

          message:
            "Application ID is required.",

        });

      }


      // ---------------------------------------------------
      // LOAD ADMISSION
      // ---------------------------------------------------

      const applicationRef =
        adminDatabase.ref(
          `admissions/${applicationId}`
        );


      const applicationSnapshot =
        await applicationRef.once("value");


      if (
        !applicationSnapshot.exists()
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Admission application not found.",

        });

      }


      const application =
        applicationSnapshot.val() as AdmissionData;


      // ---------------------------------------------------
      // CHECK APPLICATION STATUS
      // ---------------------------------------------------

      if (
        application.status === "approved"
      ) {

        return res.status(409).json({

          success: false,

          message:
            "This admission application has already been approved.",

        });

      }


      if (
        application.status === "rejected"
      ) {

        return res.status(400).json({

          success: false,

          message:
            "A rejected admission application cannot be approved.",

        });

      }


      // ---------------------------------------------------
      // GET STUDENT / PARENT INFORMATION
      // ---------------------------------------------------

      const student =
        application.student || {};


      const parent =
        application.parentGuardian || {};


      const parentName =
        String(
          parent.name || ""
        ).trim();


      const normalizedParentPhone =
        normalizePhone(
          String(parent.phone || "")
        );


      const normalizedParentEmail =
        normalizeEmail(
          String(parent.email || "")
        );


      if (!parentName) {

        return res.status(400).json({

          success: false,

          message:
            "Parent or guardian name is required.",

        });

      }


      if (!normalizedParentPhone) {

        return res.status(400).json({

          success: false,

          message:
            "Parent or guardian phone number is required.",

        });

      }


      // ---------------------------------------------------
      // FIND EXISTING PARENT
      // ---------------------------------------------------

      let existingParentId:
        string | null = null;


      let existingParent:
        FirebaseRecord | null = null;


      const parentsSnapshot =
        await adminDatabase
          .ref("parents")
          .once("value");


      if (parentsSnapshot.exists()) {

        const parents =
          parentsSnapshot.val() as Record<
            string,
            FirebaseRecord
          >;


        for (
          const [
            key,
            value
          ] of Object.entries(parents)
        ) {

          const existingPhone =
            normalizePhone(
              String(
                value.phone || ""
              )
            );


          const existingEmail =
            normalizeEmail(
              String(
                value.email || ""
              )
            );


          if (
            normalizedParentPhone &&
            existingPhone &&
            normalizedParentPhone ===
              existingPhone
          ) {

            existingParentId =
              String(
                value.parentId ||
                key
              );


            existingParent =
              value;


            break;

          }


          if (
            normalizedParentEmail &&
            existingEmail &&
            normalizedParentEmail ===
              existingEmail
          ) {

            existingParentId =
              String(
                value.parentId ||
                key
              );


            existingParent =
              value;


            break;

          }

        }

      }


      // ---------------------------------------------------
      // CREATE PARENT IF NECESSARY
      // ---------------------------------------------------

      if (!existingParentId) {

        const parentKey =
          adminDatabase
            .ref("parents")
            .push()
            .key;


        if (!parentKey) {

          throw new Error(
            "Unable to generate parent record key."
          );

        }


        const parentId =
          await generateParentId();


        const now =
          Date.now();


        const parentRecord = {

          id:
            parentKey,

          parentId,

          fullName:
            parentName,

          relationship:
            parent.relationship ||
            "Guardian",

          phone:
            parent.phone || "",

          email:
            parent.email || "",

          occupation:
            "",

          address:
            "",

          emergencyContact:
            application
              .emergencyContact
              ?.phone || "",

          status:
            "active",

          createdAt:
            now,

          updatedAt:
            now,

        };


        await adminDatabase
          .ref(`parents/${parentKey}`)
          .set(parentRecord);


        existingParentId =
          parentId;


        existingParent =
          parentRecord;

      }


      // ---------------------------------------------------
      // GENERATE STUDENT INFORMATION
      // ---------------------------------------------------

      const studentId =
        await generateStudentId();


      const temporaryPassword =
        generateTemporaryPassword();


      const studentFullName =
        [
          student.firstName,
          student.middleName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();


      const internalEmail =
        `${studentId.toLowerCase()}@students.dlittles.com`;


      // ---------------------------------------------------
      // CREATE FIREBASE AUTH USER
      // ---------------------------------------------------

      let createdUser;


      try {

        createdUser =
          await adminAuth.createUser({

            email:
              internalEmail,

            password:
              temporaryPassword,

            displayName:
              studentFullName,

            disabled:
              false,

          });

      } catch (error: unknown) {

        const errorCode =
          String(
            (
              error as {
                code?: unknown;
              }
            )?.code || ""
          );


        if (
          errorCode.includes(
            "email-already-exists"
          )
        ) {

          return res.status(409).json({

            success: false,

            message:
              "A student account already exists with this school ID.",

          });

        }


        throw error;

      }


      const uid =
        createdUser.uid;


      // ---------------------------------------------------
      // CREATE STUDENT RECORD
      // ---------------------------------------------------

      const studentRef =
        adminDatabase
          .ref("students")
          .push();


      const firebaseStudentKey =
        studentRef.key;


      if (!firebaseStudentKey) {

        await adminAuth.deleteUser(uid);

        throw new Error(
          "Unable to generate student record key."
        );

      }


      const nowIso =
        new Date().toISOString();


      const studentRecord = {

        id:
          firebaseStudentKey,

        uid,

        studentId,

        firstName:
          student.firstName || "",

        middleName:
          student.middleName || "",

        lastName:
          student.lastName || "",

        fullName:
          studentFullName,

        gender:
          student.gender || "",

        dateOfBirth:
          student.dateOfBirth || "",

        class:
          student.classApplied || "",

        parentId:
          existingParentId,

        parentName:
          String(
            existingParent?.fullName ||
            parentName
          ),

        parentPhone:
          String(
            existingParent?.phone ||
            parent.phone ||
            ""
          ),

        parentEmail:
          String(
            existingParent?.email ||
            parent.email ||
            ""
          ),

        address:
          "",

        status:
          "active",

        createdAt:
          nowIso,

        updatedAt:
          nowIso,

      };


      // ---------------------------------------------------
      // CREATE USERS RECORD
      // ---------------------------------------------------

      const userRecord = {

        uid,

        fullName:
          studentFullName,

        email:
          internalEmail,

        role:
          "student",

        studentId,

        parentId:
          existingParentId,

        status:
          "active",

        createdAt:
          nowIso,

        updatedAt:
          nowIso,

      };


      // ---------------------------------------------------
      // MULTI-LOCATION UPDATE
      // ---------------------------------------------------

      const updates: {
        [path: string]: unknown;
      } = {};


      updates[
        `students/${firebaseStudentKey}`
      ] =
        studentRecord;


      updates[
        `users/${uid}`
      ] =
        userRecord;


      updates[
        `admissions/${applicationId}/status`
      ] =
        "approved";


      updates[
        `admissions/${applicationId}/studentId`
      ] =
        studentId;


      updates[
        `admissions/${applicationId}/parentId`
      ] =
        existingParentId;


      updates[
        `admissions/${applicationId}/approvedAt`
      ] =
        nowIso;


      updates[
        `admissions/${applicationId}/studentUid`
      ] =
        uid;


      try {

        await adminDatabase
          .ref()
          .update(updates);

      } catch (error) {

        // -----------------------------------------------
        // CLEAN UP AUTH ACCOUNT IF DATABASE UPDATE FAILS
        // -----------------------------------------------

        try {

          await adminAuth.deleteUser(uid);

        } catch (cleanupError) {

          console.error(
            "Failed to clean up Firebase Auth user:",
            cleanupError
          );

        }


        throw error;

      }


      // ---------------------------------------------------
      // SUCCESS
      // ---------------------------------------------------

      return res.status(200).json({

        success:
          true,

        applicationId,

        studentId,

        parentId:
          existingParentId,

        studentUid:
          uid,

        existingParent:
          !!existingParent &&
          !!existingParentId,

        temporaryPassword,

        message:
          "Admission approved and student account created successfully.",

      });

    } catch (error: unknown) {

      console.error(
        "Approve admission error:",
        error
      );


      const status =
        getHttpStatus(error);


      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while approving the admission application.";


      return res.status(status).json({

        success:
          false,

        message,

      });

    }

  }
);


export default router;