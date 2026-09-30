import { Router, Response } from "express";
import crypto from "crypto";

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

  applicationFee?: number;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  paymentAmount?: number;
  paymentReference?: string;
  paymentDate?: string;
  paymentVerifiedAt?: number;

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
// ADMISSION PAYMENT CONFIGURATION
// =========================================================

const ADMISSION_FEE_NAIRA = 5000;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getPaystackSecretKey(): string {
  const key = String(process.env.PAYSTACK_SECRET_KEY || "").trim();

  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured on the backend.");
  }

  return key;
}

function getFrontendUrl(): string {
  return String(
    process.env.FRONTEND_URL || "http://localhost:4200"
  ).replace(/\/$/, "");
}

function getAdmissionPaymentCallbackUrl(applicationId: string): string {
  return `${getFrontendUrl()}/admissions/payment/${encodeURIComponent(applicationId)}`;
}

function createPaymentReference(applicationId: string): string {
  const safeApplicationId = applicationId.replace(/[^a-zA-Z0-9._=-]/g, "");
  return `DLP-${safeApplicationId}-${Date.now()}`;
}

async function paystackRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const secretKey = getPaystackSecretKey();

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || data?.status !== true) {
    throw new Error(
      data?.message ||
      `Paystack request failed with status ${response.status}.`
    );
  }

  return data as T;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string | null;
    channel?: string;
    customer?: {
      email?: string;
      first_name?: string;
      last_name?: string;
    };
    metadata?: unknown;
  };
}

async function loadAdmission(
  applicationId: string
): Promise<{ ref: any; data: AdmissionData }> {
  const applicationRef = adminDatabase.ref(`admissions/${applicationId}`);
  const snapshot = await applicationRef.once("value");

  if (!snapshot.exists()) {
    const error = new Error("Admission application not found.");
    (error as any).statusCode = 404;
    throw error;
  }

  return {
    ref: applicationRef,
    data: snapshot.val() as AdmissionData,
  };
}

async function verifyAndRecordAdmissionPayment(
  applicationId: string,
  reference: string
): Promise<{
  paid: boolean;
  message: string;
  paymentStatus: string;
  reference: string;
  amount: number;
}> {
  const cleanApplicationId = String(applicationId || "").trim();
  const cleanReference = String(reference || "").trim();

  if (!cleanApplicationId) {
    throw new Error("Application ID is required.");
  }

  if (!cleanReference) {
    throw new Error("Payment reference is required.");
  }

  const { ref: applicationRef, data: application } =
    await loadAdmission(cleanApplicationId);

  const storedReference = String(application.paymentReference || "").trim();

  if (storedReference && storedReference !== cleanReference) {
    const error = new Error(
      "This payment reference does not belong to this application."
    );
    (error as any).statusCode = 409;
    throw error;
  }

  const paystackResponse = await paystackRequest<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(cleanReference)}`
  );

  const transaction = paystackResponse.data;
  const transactionAmount = Number(transaction.amount);
  const transactionCurrency = String(transaction.currency || "").toUpperCase();
  const transactionStatus = String(transaction.status || "").toLowerCase();

  const expectedFee = Number(
    application.applicationFee || ADMISSION_FEE_NAIRA
  );
  const expectedAmountKobo = Math.round(expectedFee * 100);

  if (transaction.reference !== cleanReference) {
    throw new Error("Paystack returned an invalid transaction reference.");
  }

  if (transactionCurrency !== "NGN") {
    const error = new Error("The payment currency is not NGN.");
    (error as any).statusCode = 400;
    throw error;
  }

  if (transactionAmount !== expectedAmountKobo) {
    const error = new Error(
      `Payment amount mismatch. Expected ₦${expectedFee.toLocaleString()} but Paystack returned ₦${(transactionAmount / 100).toLocaleString()}.`
    );
    (error as any).statusCode = 400;
    throw error;
  }

  if (transactionStatus !== "success") {
    const failedStatus = transactionStatus || "unknown";
    const failed = ["failed", "abandoned", "reversed"].includes(failedStatus);

    await applicationRef.update({
      paymentStatus: failed ? "failed" : "pending",
      paymentReference: cleanReference,
      paymentAmount: expectedFee,
    });

    return {
      paid: false,
      message: `Payment has not completed. Paystack status: ${failedStatus}.`,
      paymentStatus: failed ? "failed" : "pending",
      reference: cleanReference,
      amount: expectedFee,
    };
  }

  const now = new Date();
  const paymentDate = transaction.paid_at || now.toISOString();

  await applicationRef.update({
    paymentStatus: "paid",
    paymentAmount: expectedFee,
    paymentReference: cleanReference,
    paymentDate,
    paymentVerifiedAt: now.getTime(),
  });

  return {
    paid: true,
    message: "Application fee payment verified successfully.",
    paymentStatus: "paid",
    reference: cleanReference,
    amount: expectedFee,
  };
}

function verifyPaystackWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string
): boolean {
  if (!signature || !rawBody) {
    return false;
  }

  const secret = getPaystackSecretKey();

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

// =========================================================
// INITIALIZE ADMISSION FEE PAYMENT
// =========================================================
// POST /api/admissions/payment/initialize
// Body: { applicationId: "..." }
// =========================================================

router.post(
  "/payment/initialize",
  async (req: any, res: Response) => {
    try {
      const applicationId =
        String(req.body?.applicationId || "").trim();

      if (!applicationId) {
        return res.status(400).json({
          success: false,
          message: "Application ID is required.",
        });
      }

      const { ref: applicationRef, data: application } =
        await loadAdmission(applicationId);

      if (application.status === "rejected") {
        return res.status(400).json({
          success: false,
          message: "A rejected admission application cannot receive a payment.",
        });
      }

      if (application.paymentStatus === "paid") {
        return res.status(409).json({
          success: false,
          message: "This application fee has already been paid.",
          paymentStatus: "paid",
          paymentReference: application.paymentReference || "",
        });
      }

      const applicationFee = Number(
        application.applicationFee || ADMISSION_FEE_NAIRA
      );

      if (!Number.isFinite(applicationFee) || applicationFee <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid application fee configured for this admission.",
        });
      }

      const parent = application.parentGuardian || {};
      const student = application.student || {};
      const email = normalizeEmail(String(parent.email || ""));

      if (!email) {
        return res.status(400).json({
          success: false,
          message:
            "A valid parent or guardian email address is required for payment.",
        });
      }

      const reference = createPaymentReference(applicationId);

      const payload = {
        email,
        amount: String(Math.round(applicationFee * 100)),
        currency: "NGN",
        reference,
        callback_url: getAdmissionPaymentCallbackUrl(applicationId),
        metadata: {
          applicationId,
          applicationNumber: String(
            (application as any).applicationNumber || ""
          ),
          applicantName: [
            student.firstName || "",
            student.middleName || "",
            student.lastName || "",
          ]
            .filter(Boolean)
            .join(" ")
            .trim(),
          paymentType: "admission_application_fee",
        },
      };

      const paystackResponse =
        await paystackRequest<PaystackInitializeResponse>(
          "/transaction/initialize",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

      const payment = paystackResponse.data;

      await applicationRef.update({
        paymentStatus: "pending",
        paymentAmount: applicationFee,
        paymentReference: payment.reference,
        paymentDate: "",
        paymentVerifiedAt: 0,
      });

      return res.status(200).json({
        success: true,
        message: "Payment initialized successfully.",
        applicationId,
        applicationFee,
        amountKobo: Math.round(applicationFee * 100),
        reference: payment.reference,
        accessCode: payment.access_code,
        authorizationUrl: payment.authorization_url,
      });
    } catch (error: unknown) {
      console.error("Initialize admission payment error:", error);

      const statusCode =
        Number((error as any)?.statusCode) || 500;

      return res.status(statusCode).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to initialize the admission fee payment.",
      });
    }
  }
);

// =========================================================
// VERIFY ADMISSION FEE PAYMENT
// =========================================================
// GET /api/admissions/payment/verify/:applicationId/:reference
// =========================================================

router.get(
  "/payment/verify/:applicationId/:reference",
  async (req: any, res: Response) => {
    try {
      const applicationId =
        String(req.params.applicationId || "").trim();
      const reference =
        String(req.params.reference || "").trim();

      if (!applicationId || !reference) {
        return res.status(400).json({
          success: false,
          message: "Application ID and payment reference are required.",
        });
      }

      const result = await verifyAndRecordAdmissionPayment(
        applicationId,
        reference
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: unknown) {
      console.error("Verify admission payment error:", error);

      const statusCode =
        Number((error as any)?.statusCode) ||
        (String((error as any)?.message || "").includes("not found") ? 404 : 500);

      return res.status(statusCode).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify the admission fee payment.",
      });
    }
  }
);

// =========================================================
// PAYSTACK WEBHOOK
// =========================================================
// POST /api/admissions/payment/webhook
// =========================================================

router.post(
  "/payment/webhook",
  async (req: any, res: Response) => {
    try {
      const signature = String(
        req.headers["x-paystack-signature"] || ""
      ).trim();

      if (
        !verifyPaystackWebhookSignature(
          req.rawBody,
          signature
        )
      ) {
        console.warn("Rejected invalid Paystack webhook signature.");

        return res.status(401).json({
          success: false,
          message: "Invalid webhook signature.",
        });
      }

      // Acknowledge Paystack immediately after validating the signature.
      res.status(200).json({
        success: true,
        received: true,
      });

      const event = req.body || {};

      if (event.event !== "charge.success") {
        return;
      }

      const transaction = event.data || {};
      const reference = String(transaction.reference || "").trim();

      if (!reference) {
        console.warn(
          "Paystack webhook did not contain a transaction reference."
        );
        return;
      }

      let applicationId = String(
        transaction.metadata?.applicationId ||
        transaction.metadata?.application_id ||
        ""
      ).trim();

      if (!applicationId) {
        const admissionsSnapshot =
          await adminDatabase.ref("admissions").once("value");

        if (admissionsSnapshot.exists()) {
          const admissions =
            admissionsSnapshot.val() as Record<string, AdmissionData>;

          for (const [id, admission] of Object.entries(admissions)) {
            if (
              String(admission.paymentReference || "").trim() ===
              reference
            ) {
              applicationId = id;
              break;
            }
          }
        }
      }

      if (!applicationId) {
        console.warn(
          "Paystack webhook could not identify an admission for reference:",
          reference
        );
        return;
      }

      try {
        await verifyAndRecordAdmissionPayment(
          applicationId,
          reference
        );
      } catch (verificationError) {
        console.error(
          "Admission payment webhook verification failed:",
          verificationError
        );
      }
    } catch (error) {
      console.error("Paystack admission webhook error:", error);

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: "Webhook processing failed.",
        });
      }
    }
  }
);


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
// }
//
// =========================================================

router.post(
  "/approve",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    let createdStudentUid: string | null = null;
    let createdParentUid: string | null = null;

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


      // ===================================================
      // FIND EXISTING PARENT
      // ===================================================

      let existingParentRecordKey:
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

            existingParentRecordKey =
              key;

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

            existingParentRecordKey =
              key;

            existingParent =
              value;

            break;

          }

        }

      }


      // ===================================================
      // PARENT ACCOUNT VARIABLES
      // ===================================================

      let parentRecordKey =
        existingParentRecordKey;

      let parentCode =
        String(
          existingParent?.parentId || ""
        ).trim();

      let parentUid =
        String(
          existingParent?.uid || ""
        ).trim() || null;

      let parentTemporaryPassword:
        string | null = null;

      let parentAccountCreated =
        false;


      // ===================================================
      // CREATE PARENT RECORD ID
      // ===================================================

      if (!parentCode) {

        parentCode =
          await generateParentId();

      }


      // ===================================================
      // CREATE PARENT AUTH ACCOUNT
      // ===================================================

      const parentInternalEmail =
        `${parentCode.toLowerCase()}@parents.dlittles.com`;


      if (!parentUid) {

        parentTemporaryPassword =
          generateTemporaryPassword();


        try {

          const parentUser =
            await adminAuth.createUser({

              email:
                parentInternalEmail,

              password:
                parentTemporaryPassword,

              displayName:
                parentName,

              disabled:
                false,

            });


          parentUid =
            parentUser.uid;

          createdParentUid =
            parentUid;

          parentAccountCreated =
            true;

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

            const existingAuthUser =
              await adminAuth
                .getUserByEmail(
                  parentInternalEmail
                );

            parentUid =
              existingAuthUser.uid;

          } else {

            throw error;

          }

        }

      }


      if (!parentUid) {

        throw new Error(
          "Unable to create or identify the parent Firebase account."
        );

      }


      // ===================================================
      // CREATE / UPDATE PARENT RECORD KEY
      // ===================================================

      if (!parentRecordKey) {

        const parentRef =
          adminDatabase
            .ref("parents")
            .push();

        parentRecordKey =
          parentRef.key;

        if (!parentRecordKey) {

          throw new Error(
            "Unable to generate parent record key."
          );

        }

      }


      const nowIso =
        new Date().toISOString();


      // ===================================================
      // PRESERVE EXISTING CHILDREN
      // ===================================================

      const existingChildren =
        (
          existingParent?.children &&
          typeof existingParent.children === "object"
        )
          ? existingParent.children as FirebaseRecord
          : {};


      const updatedChildren: FirebaseRecord = {

        ...existingChildren,

      };


      // Student UID is added after the student Auth
      // account is created.


      // ===================================================
      // CREATE / UPDATE PARENT RECORD
      // ===================================================

      const parentRecord: FirebaseRecord = {

        id:
          parentRecordKey,

        uid:
          parentUid,

        parentId:
          parentCode,

        fullName:
          String(
            existingParent?.fullName ||
            parentName
          ),

        relationship:
          String(
            existingParent?.relationship ||
            parent.relationship ||
            "Guardian"
          ),

        phone:
          String(
            existingParent?.phone ||
            parent.phone ||
            ""
          ),

        email:
          String(
            existingParent?.email ||
            parent.email ||
            ""
          ),

        occupation:
          String(
            existingParent?.occupation ||
            ""
          ),

        address:
          String(
            existingParent?.address ||
            ""
          ),

        emergencyContact:
          String(
            existingParent?.emergencyContact ||
            application.emergencyContact?.phone ||
            ""
          ),

        status:
          "active",

        children:
          updatedChildren,

        createdAt:
          String(
            existingParent?.createdAt ||
            nowIso
          ),

        updatedAt:
          nowIso,

      };


      // ===================================================
      // GENERATE STUDENT INFORMATION
      // ===================================================

      const studentId =
        await generateStudentId();

      const studentTemporaryPassword =
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


      const studentInternalEmail =
        `${studentId.toLowerCase()}@students.dlittles.com`;


      // ===================================================
      // CREATE STUDENT FIREBASE AUTH ACCOUNT
      // ===================================================

      let createdStudent;

      try {

        createdStudent =
          await adminAuth.createUser({

            email:
              studentInternalEmail,

            password:
              studentTemporaryPassword,

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


      const studentUid =
        createdStudent.uid;

      createdStudentUid =
        studentUid;


      // ===================================================
      // ADD NEW CHILD TO PARENT
      // ===================================================

      updatedChildren[studentUid] =
        true;


      parentRecord.children =
        updatedChildren;


      // ===================================================
      // CREATE STUDENT RECORD
      // ===================================================

      const studentRef =
        adminDatabase
          .ref("students")
          .push();

      const firebaseStudentKey =
        studentRef.key;


      if (!firebaseStudentKey) {

        throw new Error(
          "Unable to generate student record key."
        );

      }


      const studentRecord = {

        id:
          firebaseStudentKey,

        uid:
          studentUid,

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

        // IMPORTANT:
        // This is the Firebase UID of the parent.
        parentId:
          parentUid,

        // Human-readable parent school ID.
        parentCode:
          parentCode,

        parentName:
          parentRecord.fullName,

        parentPhone:
          parentRecord.phone,

        parentEmail:
          parentRecord.email,

        address:
          "",

        status:
          "active",

        createdAt:
          nowIso,

        updatedAt:
          nowIso,

      };


      // ===================================================
      // CREATE STUDENT USERS RECORD
      // ===================================================

      const studentUserRecord = {

        uid:
          studentUid,

        fullName:
          studentFullName,

        email:
          studentInternalEmail,

        role:
          "student",

        studentId,

        studentRecordId:
          firebaseStudentKey,

        parentId:
          parentUid,

        parentCode:
          parentCode,

        status:
          "active",

        createdAt:
          nowIso,

        updatedAt:
          nowIso,

      };


      // ===================================================
      // CREATE PARENT USERS RECORD
      // ===================================================

      const parentUserRecord = {

        uid:
          parentUid,

        fullName:
          parentRecord.fullName,

        email:
          parentInternalEmail,

        role:
          "parent",

        parentId:
          parentCode,

        parentRecordId:
          parentRecordKey,

        status:
          "active",

        createdAt:
          String(
            existingParent?.createdAt ||
            nowIso
          ),

        updatedAt:
          nowIso,

      };


      // ===================================================
      // MULTI-LOCATION UPDATE
      // ===================================================
      //
      // IMPORTANT:
      //
      // We MUST NOT update:
      //
      // parents/{parentRecordKey}
      //
      // and:
      //
      // parents/{parentRecordKey}/children/{studentUid}
      //
      // separately in the same update.
      //
      // The children object is now included inside
      // parentRecord, so there is only ONE write to
      // parents/{parentRecordKey}.
      // ===================================================

      const updates: {
        [path: string]: unknown;
      } = {};


      updates[
        `parents/${parentRecordKey}`
      ] =
        parentRecord;


      updates[
        `users/${studentUid}`
      ] =
        studentUserRecord;


      updates[
        `users/${parentUid}`
      ] =
        parentUserRecord;


      updates[
        `students/${firebaseStudentKey}`
      ] =
        studentRecord;


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
        parentCode;


      updates[
        `admissions/${applicationId}/studentUid`
      ] =
        studentUid;


      updates[
        `admissions/${applicationId}/parentUid`
      ] =
        parentUid;


      updates[
        `admissions/${applicationId}/approvedAt`
      ] =
        nowIso;


      // ---------------------------------------------------
      // SAVE EVERYTHING
      // ---------------------------------------------------

      try {

        await adminDatabase
          .ref()
          .update(updates);

      } catch (error) {

        // -----------------------------------------------
        // CLEAN UP STUDENT AUTH ACCOUNT
        // -----------------------------------------------

        if (createdStudentUid) {

          try {

            await adminAuth.deleteUser(
              createdStudentUid
            );

          } catch (cleanupError) {

            console.error(
              "Failed to clean up student Auth account:",
              cleanupError
            );

          }

        }


        // -----------------------------------------------
        // CLEAN UP NEW PARENT AUTH ACCOUNT
        // -----------------------------------------------

        if (
          createdParentUid &&
          parentAccountCreated
        ) {

          try {

            await adminAuth.deleteUser(
              createdParentUid
            );

          } catch (cleanupError) {

            console.error(
              "Failed to clean up parent Auth account:",
              cleanupError
            );

          }

        }

        throw error;

      }


      // ===================================================
      // SUCCESS
      // ===================================================

      return res.status(200).json({

        success:
          true,

        applicationId,

        // -----------------------------------------------
        // STUDENT
        // -----------------------------------------------

        student: {

          studentId,

          uid:
            studentUid,

          temporaryPassword:
            studentTemporaryPassword,

          email:
            studentInternalEmail,

        },

        // -----------------------------------------------
        // PARENT
        // -----------------------------------------------

        parent: {

          parentId:
            parentCode,

          uid:
            parentUid,

          temporaryPassword:
            parentTemporaryPassword,

          email:
            parentInternalEmail,

          accountCreated:
            parentAccountCreated,

        },

        // -----------------------------------------------
        // DATABASE RECORDS
        // -----------------------------------------------

        studentRecordId:
          firebaseStudentKey,

        parentRecordId:
          parentRecordKey,

        // -----------------------------------------------
        // BACKWARD-COMPATIBLE FIELDS
        // -----------------------------------------------

        studentId,

        parentId:
          parentCode,

        studentUid,

        parentUid,

        existingParent:
          !!existingParentRecordKey,

        temporaryPassword:
          studentTemporaryPassword,

        message:
          parentAccountCreated
            ? "Admission approved successfully. Student and parent accounts were created."
            : "Admission approved successfully. Student account was created and the existing parent account was linked.",

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