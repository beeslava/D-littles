import {setGlobalOptions} from "firebase-functions";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {initializeApp} from "firebase-admin/app";

initializeApp();

setGlobalOptions({
  maxInstances: 10,
});

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

/**
 * Generates a sequential ID using a Firebase database transaction.
 */
async function generateSequentialId(
  db: ReturnType<typeof getDatabase>,
  recordsPath: string,
  counterPath: string,
  prefix: string,
  fieldName: string
): Promise<string> {
  const counterRef =
    db.ref(counterPath);

  const counterSnapshot =
    await counterRef.once("value");

  let highestExistingNumber = 0;

  if (!counterSnapshot.exists()) {
    const recordsSnapshot =
      await db.ref(recordsPath).once("value");

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
          return highestExistingNumber + 2;
        }

        return Math.floor(currentValue) + 1;
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

  return `${prefix}-${String(generatedNumber).padStart(6, "0")}`;
}

/**
 * Generates the next Student ID.
 */
async function generateStudentId(
  db: ReturnType<typeof getDatabase>
): Promise<string> {
  return generateSequentialId(
    db,
    "students",
    "counters/students/nextNumber",
    "DL-S",
    "studentId"
  );
}

/**
 * Generates the next Parent ID.
 */
async function generateParentId(
  db: ReturnType<typeof getDatabase>
): Promise<string> {
  return generateSequentialId(
    db,
    "parents",
    "counters/parents/nextNumber",
    "DL-P",
    "parentId"
  );
}

/**
 * Normalizes a Nigerian phone number.
 */
function normalizePhone(
  phone: string
): string {
  let value =
    String(phone || "")
      .trim()
      .replace(/[\s\-().]/g, "");

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

/**
 * Normalizes an email address.
 */
function normalizeEmail(
  email: string
): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Generates a temporary student password.
 */
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

/**
 * Safely extracts a Firebase error code.
 */
function getErrorCode(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      (error as {code: unknown}).code
    );
  }

  return "";
}

/**
 * Approves an admission application and creates
 * the associated parent, student, Firebase Auth,
 * and school user records.
 */
export const approveAdmissionApplication =
  onCall(async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const adminUid =
      request.auth.uid;

    const db =
      getDatabase();

    const auth =
      getAuth();

    const adminSnapshot =
      await db
        .ref(`users/${adminUid}`)
        .once("value");

    if (!adminSnapshot.exists()) {
      throw new HttpsError(
        "permission-denied",
        "Administrator account could not be found."
      );
    }

    const adminUser =
      adminSnapshot.val() as FirebaseRecord;

    if (adminUser.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Administrator access is required."
      );
    }

    const applicationId =
      String(
        request.data?.applicationId || ""
      ).trim();

    if (!applicationId) {
      throw new HttpsError(
        "invalid-argument",
        "Application ID is required."
      );
    }

    const applicationRef =
      db.ref(
        `admissions/${applicationId}`
      );

    const applicationSnapshot =
      await applicationRef.once("value");

    if (!applicationSnapshot.exists()) {
      throw new HttpsError(
        "not-found",
        "Admission application not found."
      );
    }

    const application =
      applicationSnapshot.val() as AdmissionData;

    if (
      application.status ===
      "approved"
    ) {
      throw new HttpsError(
        "already-exists",
        "This application has already been approved."
      );
    }

    if (
      application.status ===
      "rejected"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "A rejected application cannot be approved directly."
      );
    }

    const student =
      application.student || {};

    const parent =
      application.parentGuardian || {};

    const parentName =
      String(
        parent.name || ""
      ).trim();

    const parentPhone =
      normalizePhone(
        parent.phone || ""
      );

    const parentEmail =
      normalizeEmail(
        parent.email || ""
      );

    if (!parentName) {
      throw new HttpsError(
        "failed-precondition",
        "Parent or guardian name is missing."
      );
    }

    if (!parentPhone) {
      throw new HttpsError(
        "failed-precondition",
        "Parent or guardian phone number is missing."
      );
    }

    const parentsSnapshot =
      await db
        .ref("parents")
        .once("value");

    let existingParentId =
      "";

    let existingParent:
      FirebaseRecord | null = null;

    if (parentsSnapshot.exists()) {
      const parents =
        parentsSnapshot.val() as Record<
          string,
          FirebaseRecord
        >;

      for (
        const [
          firebaseKey,
          value,
        ] of Object.entries(parents)
      ) {
        const currentParent =
          value;

        const currentPhone =
          normalizePhone(
            String(
              currentParent.phone ||
              currentParent.phoneNumber ||
              ""
            )
          );

        const currentEmail =
          normalizeEmail(
            String(
              currentParent.email ||
              ""
            )
          );

        if (
          parentPhone &&
          currentPhone &&
          parentPhone === currentPhone
        ) {
          existingParentId =
            String(
              currentParent.parentId ||
              firebaseKey
            );

          existingParent =
            currentParent;

          break;
        }

        if (
          !existingParentId &&
          parentEmail &&
          currentEmail &&
          parentEmail === currentEmail
        ) {
          existingParentId =
            String(
              currentParent.parentId ||
              firebaseKey
            );

          existingParent =
            currentParent;

          break;
        }
      }
    }

    let parentId =
      existingParentId;

    if (!parentId) {
      const newParentRef =
        db.ref("parents").push();

      const firebaseParentKey =
        newParentRef.key;

      if (!firebaseParentKey) {
        throw new HttpsError(
          "internal",
          "Unable to generate parent record."
        );
      }

      parentId =
        await generateParentId(db);

      const parentData = {
        id: firebaseParentKey,
        parentId,
        fullName: parentName,
        relationship:
          parent.relationship ||
          "Guardian",
        phone:
          parent.phone ||
          "",
        email:
          parent.email ||
          "",
        occupation: "",
        address: "",
        emergencyContact:
          application
            .emergencyContact
            ?.phone ||
          "",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await newParentRef.set(
        parentData
      );

      existingParent =
        parentData;
    }

    const studentId =
      await generateStudentId(db);

    const temporaryPassword =
      generateTemporaryPassword();

    const internalEmail =
      `${studentId.toLowerCase()}@students.dlittles.com`;

    let firebaseUser;

    try {
      firebaseUser =
        await auth.createUser({
          email: internalEmail,
          password: temporaryPassword,
          displayName: [
            student.firstName,
            student.middleName,
            student.lastName,
          ]
            .filter(Boolean)
            .join(" "),
          disabled: false,
        });
    } catch (error: unknown) {
      console.error(
        "Firebase student account creation error:",
        error
      );

      const errorCode =
        getErrorCode(error);

      if (
        errorCode ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "A student account with this Student ID already exists."
        );
      }

      throw new HttpsError(
        "internal",
        "Unable to create the student login account."
      );
    }

    const uid =
      firebaseUser.uid;

    const studentRef =
      db.ref("students").push();

    const firebaseStudentKey =
      studentRef.key;

    if (!firebaseStudentKey) {
      await auth.deleteUser(uid);

      throw new HttpsError(
        "internal",
        "Unable to generate student record."
      );
    }

    const studentFullName =
      [
        student.firstName,
        student.middleName,
        student.lastName,
      ]
        .filter(Boolean)
        .join(" ");

    const studentData = {
      id: firebaseStudentKey,
      uid,
      studentId,
      firstName:
        student.firstName ||
        "",
      middleName:
        student.middleName ||
        "",
      lastName:
        student.lastName ||
        "",
      fullName:
        studentFullName,
      gender:
        student.gender ||
        "",
      dateOfBirth:
        student.dateOfBirth ||
        "",
      class:
        student.classApplied ||
        "",
      parentId,
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
      address: "",
      status: "active",
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    const userData = {
      uid,
      fullName:
        studentFullName,
      email:
        internalEmail,
      role: "student",
      studentId,
      parentId,
      status: "active",
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    const updates:
      Record<string, unknown> = {};

    updates[
      `students/${firebaseStudentKey}`
    ] =
      studentData;

    updates[
      `users/${uid}`
    ] =
      userData;

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
      parentId;

    updates[
      `admissions/${applicationId}/approvedAt`
    ] =
      new Date().toISOString();

    updates[
      `admissions/${applicationId}/studentUid`
    ] =
      uid;

    try {
      await db
        .ref()
        .update(updates);
    } catch (error: unknown) {
      console.error(
        "Failed to save admission approval records:",
        error
      );

      try {
        await auth.deleteUser(uid);
      } catch (cleanupError: unknown) {
        console.error(
          "Failed to clean up Firebase Auth user:",
          cleanupError
        );
      }

      throw new HttpsError(
        "internal",
        "Unable to save the approved admission records."
      );
    }

    return {
      success: true,
      applicationId,
      studentId,
      parentId,
      studentUid: uid,
      existingParent:
        !!existingParentId,
      temporaryPassword,
      message:
        "Admission approved and student account created successfully.",
    };
  });
