import { Router, Response } from "express";
import crypto from "crypto";

import {
  requireAuth,
  requireAdminPermission,
  AuthenticatedRequest,
} from "./auth-middleware.js";

import {
  adminAuth,
  adminDatabase,
} from "./firebase-admin.js";

import { sendGmailEmail } from "./gmail-service.js";

const router = Router();

// =========================================================
// TYPES
// =========================================================

interface AdmissionData {
  applicationId?: string;
  applicationNumber?: string;
  status?: string;

  applicationFee?: number;

  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  paymentAmount?: number;
  paymentReference?: string;
  paymentDate?: string;
  paymentVerifiedAt?: number;

  submittedAt?: string | number;

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

  notificationStatus?: {
    email?: "sent" | "failed" | "skipped";
    sms?: "sent" | "failed" | "skipped";
    lastAttemptAt?: string;
    lastError?: string;
  };

  notificationSentAt?: string;

  studentId?: string;
  parentId?: string;
  studentUid?: string;
  parentUid?: string;
  approvedAt?: string;
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
  const counterRef = adminDatabase.ref(counterPath);

  const counterSnapshot = await counterRef.once("value");

  let highestExistingNumber = 0;

  if (!counterSnapshot.exists()) {
    const recordsSnapshot = await adminDatabase
      .ref(recordsPath)
      .once("value");

    if (recordsSnapshot.exists()) {
      const records =
        recordsSnapshot.val() as Record<string, FirebaseRecord>;

      Object.values(records).forEach(
        (value: FirebaseRecord) => {
          const existingId = String(
            value[fieldName] || ""
          );

          const match = existingId.match(
            new RegExp(`^${prefix}-(\\d+)$`)
          );

          if (match) {
            const number = Number(match[1]);

            if (
              Number.isInteger(number) &&
              number > highestExistingNumber
            ) {
              highestExistingNumber = number;
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

  const counterValue = Number(
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

  const generatedNumber = counterValue - 1;

  return `${prefix}-${String(generatedNumber).padStart(6, "0")}`;
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

function normalizePhone(phone: string): string {
  let value = String(phone || "")
    .trim()
    .replace(/[\s\-().]/g, "");

  if (
    value.startsWith("0") &&
    value.length === 11
  ) {
    value = `234${value.substring(1)}`;
  }

  if (value.startsWith("+")) {
    value = value.substring(1);
  }

  return value;
}

function normalizeEmail(email: string): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function generateTemporaryPassword(): string {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let password = "";

  for (let i = 0; i < 10; i++) {
    const index = Math.floor(
      Math.random() * characters.length
    );

    password += characters[index];
  }

  return password;
}

function generateApplicationNumber(): string {
  const year = new Date().getFullYear();

  const randomPart = Math.floor(
    1000 + Math.random() * 9000
  );

  return `DLP-${year}-${randomPart}`;
}

// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =========================================================
// ERROR STATUS HELPER
// =========================================================

function getHttpStatus(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = String(
      (error as { code: unknown }).code
    );

    if (code.includes("already-exists")) {
      return 409;
    }

    if (code.includes("not-found")) {
      return 404;
    }

    if (code.includes("permission-denied")) {
      return 403;
    }

    if (code.includes("unauthenticated")) {
      return 401;
    }

    if (code.includes("invalid-argument")) {
      return 400;
    }

    if (code.includes("failed-precondition")) {
      return 412;
    }
  }

  const statusCode = Number(
    (error as any)?.statusCode
  );

  if (
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599
  ) {
    return statusCode;
  }

  return 500;
}

// =========================================================
// ADMISSION PAYMENT CONFIGURATION
// =========================================================

const ADMISSION_FEE_NAIRA = 5000;

const PAYSTACK_BASE_URL =
  "https://api.paystack.co";

function getPaystackSecretKey(): string {
  const key = String(
    process.env.PAYSTACK_SECRET_KEY || ""
  ).trim();

  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured on the backend."
    );
  }

  return key;
}

function getFrontendUrl(): string {
  return String(
    process.env.FRONTEND_URL ||
      "http://localhost:4200"
  )
    .trim()
    .replace(/\/$/, "");
}

function getAdmissionPaymentCallbackUrl(
  applicationId: string
): string {
  return `${getFrontendUrl()}/admissions/payment/${encodeURIComponent(
    applicationId
  )}`;
}

function createPaymentReference(
  applicationId: string
): string {
  const safeApplicationId =
    applicationId.replace(
      /[^a-zA-Z0-9._=-]/g,
      ""
    );

  return `DLP-${safeApplicationId}-${Date.now()}`;
}

async function paystackRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const secretKey =
    getPaystackSecretKey();

  const response = await fetch(
    `${PAYSTACK_BASE_URL}${path}`,
    {
      ...options,

      headers: {
        Authorization:
          `Bearer ${secretKey}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {}),
      },
    }
  );

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (
    !response.ok ||
    data?.status !== true
  ) {
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

// =========================================================
// LOAD ADMISSION
// =========================================================

async function loadAdmission(
  applicationId: string
): Promise<{
  ref: any;
  data: AdmissionData;
}> {
  const applicationRef =
    adminDatabase.ref(
      `admissions/${applicationId}`
    );

  const snapshot =
    await applicationRef.once("value");

  if (!snapshot.exists()) {
    const error = new Error(
      "Admission application not found."
    );

    (error as any).statusCode = 404;

    throw error;
  }

  return {
    ref: applicationRef,

    data:
      snapshot.val() as AdmissionData,
  };
}

// =========================================================
// VERIFY AND RECORD PAYMENT
// =========================================================

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
  const cleanApplicationId =
    String(applicationId || "").trim();

  const cleanReference =
    String(reference || "").trim();

  if (!cleanApplicationId) {
    throw new Error(
      "Application ID is required."
    );
  }

  if (!cleanReference) {
    throw new Error(
      "Payment reference is required."
    );
  }

  const {
    ref: applicationRef,
    data: application,
  } = await loadAdmission(
    cleanApplicationId
  );

  const storedReference =
    String(
      application.paymentReference || ""
    ).trim();

  if (
    storedReference &&
    storedReference !== cleanReference
  ) {
    const error = new Error(
      "This payment reference does not belong to this application."
    );

    (error as any).statusCode = 409;

    throw error;
  }

  const paystackResponse =
    await paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(
        cleanReference
      )}`
    );

  const transaction =
    paystackResponse.data;

  const transactionAmount =
    Number(transaction.amount);

  const transactionCurrency =
    String(
      transaction.currency || ""
    ).toUpperCase();

  const transactionStatus =
    String(
      transaction.status || ""
    ).toLowerCase();

  const expectedFee =
    Number(
      application.applicationFee ||
        ADMISSION_FEE_NAIRA
    );

  const expectedAmountKobo =
    Math.round(expectedFee * 100);

  if (
    transaction.reference !==
    cleanReference
  ) {
    throw new Error(
      "Paystack returned an invalid transaction reference."
    );
  }

  if (
    transactionCurrency !== "NGN"
  ) {
    const error = new Error(
      "The payment currency is not NGN."
    );

    (error as any).statusCode = 400;

    throw error;
  }

  if (
    transactionAmount !==
    expectedAmountKobo
  ) {
    const error = new Error(
      `Payment amount mismatch. Expected ₦${expectedFee.toLocaleString(
        "en-NG"
      )} but Paystack returned ₦${(
        transactionAmount / 100
      ).toLocaleString("en-NG")}.`
    );

    (error as any).statusCode = 400;

    throw error;
  }

  if (
    transactionStatus !== "success"
  ) {
    const failedStatus =
      transactionStatus || "unknown";

    const failed = [
      "failed",
      "abandoned",
      "reversed",
    ].includes(failedStatus);

    await applicationRef.update({
      paymentStatus:
        failed ? "failed" : "pending",

      paymentReference:
        cleanReference,

      paymentAmount:
        expectedFee,
    });

    return {
      paid: false,

      message:
        `Payment has not completed. Paystack status: ${failedStatus}.`,

      paymentStatus:
        failed ? "failed" : "pending",

      reference:
        cleanReference,

      amount:
        expectedFee,
    };
  }

  const now = new Date();

  const paymentDate =
    transaction.paid_at ||
    now.toISOString();

  await applicationRef.update({
    paymentStatus: "paid",

    paymentAmount:
      expectedFee,

    paymentReference:
      cleanReference,

    paymentDate,

    paymentVerifiedAt:
      now.getTime(),
  });

  return {
    paid: true,

    message:
      "Application fee payment verified successfully.",

    paymentStatus: "paid",

    reference:
      cleanReference,

    amount:
      expectedFee,
  };
}

// =========================================================
// PAYSTACK WEBHOOK SIGNATURE
// =========================================================

function verifyPaystackWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string
): boolean {
  if (
    !signature ||
    !rawBody
  ) {
    return false;
  }

  const secret =
    getPaystackSecretKey();

  const expected =
    crypto
      .createHmac(
        "sha512",
        secret
      )
      .update(rawBody)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  const signatureBuffer =
    Buffer.from(
      signature,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    signatureBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    signatureBuffer
  );
}

// =========================================================
// NOTIFICATION CONFIGURATION
// =========================================================

function getTermiiApiKey(): string {
  return String(
    process.env.TERMII_API_KEY || ""
  ).trim();
}

function getTermiiBaseUrl(): string {
  return String(
    process.env.TERMII_BASE_URL ||
      "https://api.ng.termii.com"
  )
    .trim()
    .replace(/\/$/, "");
}

function getTermiiSenderId(): string {
  return String(
    process.env.TERMII_SENDER_ID ||
      "D-Littles"
  ).trim();
}

function getParentLoginUrl(): string {
  return String(
    process.env.PARENT_LOGIN_URL ||
      `${getFrontendUrl()}/parent/login`
  ).trim();
}

function getStudentLoginUrl(): string {
  return String(
    process.env.STUDENT_LOGIN_URL ||
      `${getFrontendUrl()}/login`
  ).trim();
}

// =========================================================
// ADMISSION NOTIFICATION DATA
// =========================================================

interface AdmissionNotificationData {
  parentName: string;
  parentId: string;

  parentEmail: string;
  parentPhone: string;

  parentLoginEmail: string;
  parentTemporaryPassword: string | null;

  studentName: string;
  studentId: string;

  studentLoginEmail: string;
  studentTemporaryPassword: string;

  className: string;
}

// =========================================================
// SEND ADMISSION EMAIL WITH GMAIL API
// =========================================================

async function sendAdmissionEmail(
  data: AdmissionNotificationData
): Promise<{
  sent: boolean;
  reason?: string;
}> {
  if (!data.parentEmail) {
    return {
      sent: false,
      reason:
        "Parent email address is not available.",
    };
  }

  const parentPasswordText =
    data.parentTemporaryPassword
      ? escapeHtml(
          data.parentTemporaryPassword
        )
      : "Use your existing parent account password.";

  const subject =
    `Admission Approved - ${data.studentName} | D Little Private School`;

  const parentLoginUrl =
    getParentLoginUrl();

  const studentLoginUrl =
    getStudentLoginUrl();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>Admission Approved</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f6f8;
    font-family:Arial,Helvetica,sans-serif;
    color:#1f2937;
  "
>
  <div
    style="
      max-width:680px;
      margin:30px auto;
      background:#ffffff;
      border-radius:12px;
      overflow:hidden;
      box-shadow:0 4px 18px rgba(0,0,0,0.08);
    "
  >

    <div
      style="
        background:#123b72;
        color:#ffffff;
        padding:30px;
        text-align:center;
      "
    >
      <h1
        style="
          margin:0 0 8px;
          font-size:26px;
        "
      >
        D LITTLE PRIVATE SCHOOL
      </h1>

      <p
        style="
          margin:0;
          font-size:15px;
        "
      >
        Admission Approval Notification
      </p>
    </div>

    <div style="padding:30px;">

      <h2
        style="
          margin-top:0;
          color:#123b72;
        "
      >
        Dear ${escapeHtml(data.parentName)},
      </h2>

      <p
        style="
          font-size:15px;
          line-height:1.7;
        "
      >
        We are pleased to inform you that the admission
        application for
        <strong>
          ${escapeHtml(data.studentName)}
        </strong>
        has been approved.
      </p>

      <div
        style="
          background:#ecfdf5;
          border:1px solid #a7f3d0;
          border-radius:8px;
          padding:16px;
          margin:20px 0;
        "
      >
        <strong style="color:#047857;">
          Admission Status: APPROVED
        </strong>
      </div>

      <h3 style="color:#123b72;">
        Student Details
      </h3>

      <table
        style="
          width:100%;
          border-collapse:collapse;
        "
      >
        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Student Name
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.studentName)}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Student ID
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.studentId)}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Class
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.className)}
          </td>
        </tr>
      </table>

      <h3
        style="
          color:#123b72;
          margin-top:28px;
        "
      >
        Parent Login Details
      </h3>

      <table
        style="
          width:100%;
          border-collapse:collapse;
        "
      >
        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Parent ID
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.parentId)}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Login Email
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.parentLoginEmail)}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Password
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${parentPasswordText}
          </td>
        </tr>
      </table>

      <p style="margin-top:16px;">
        <strong>Parent Login:</strong>
        <br>

        <a
          href="${escapeHtml(parentLoginUrl)}"
        >
          ${escapeHtml(parentLoginUrl)}
        </a>
      </p>

      <h3
        style="
          color:#123b72;
          margin-top:28px;
        "
      >
        Student Login Details
      </h3>

      <table
        style="
          width:100%;
          border-collapse:collapse;
        "
      >
        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Student ID
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.studentId)}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Login Email
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(data.studentLoginEmail)}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
              font-weight:bold;
            "
          >
            Temporary Password
          </td>

          <td
            style="
              padding:9px;
              border-bottom:1px solid #eee;
            "
          >
            ${escapeHtml(
              data.studentTemporaryPassword
            )}
          </td>
        </tr>
      </table>

      <p style="margin-top:16px;">
        <strong>Student Login:</strong>
        <br>

        <a
          href="${escapeHtml(studentLoginUrl)}"
        >
          ${escapeHtml(studentLoginUrl)}
        </a>
      </p>

      <div
        style="
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:8px;
          padding:16px;
          margin-top:25px;
        "
      >
        <strong>Important:</strong>

        Please keep these login details secure and change
        the temporary password after the first login.
      </div>

      <p
        style="
          margin-top:28px;
          line-height:1.7;
        "
      >
        Congratulations and welcome to
        D Little Private School.
      </p>

      <p>
        Regards,<br>
        <strong>
          D Little Private School Administration
        </strong>
      </p>

    </div>

    <div
      style="
        background:#f8fafc;
        padding:18px;
        text-align:center;
        color:#64748b;
        font-size:12px;
      "
    >
      This is an automated admission notification
      from D Little Private School.
    </div>

  </div>
</body>
</html>
`;

  try {
    await sendGmailEmail({
      to: data.parentEmail,
      subject,
      html,
    });

    return {
      sent: true,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Gmail error.";

    console.error(
      "Gmail admission email failed:",
      error
    );

    return {
      sent: false,
      reason: message,
    };
  }
}

// =========================================================
// SEND SMS WITH TERMII
// =========================================================

async function sendAdmissionSms(
  data: AdmissionNotificationData
): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const apiKey =
    getTermiiApiKey();

  if (!data.parentPhone) {
    return {
      sent: false,
      reason:
        "Parent phone number is not available.",
    };
  }

  if (!apiKey) {
    return {
      sent: false,
      reason:
        "TERMII_API_KEY is not configured.",
    };
  }

  const parentPassword =
    data.parentTemporaryPassword
      ? data.parentTemporaryPassword
      : "Use your existing parent password.";

  const sms =
    `D LITTLE PRIVATE SCHOOL: Admission APPROVED. ` +
    `Student: ${data.studentName}. ` +
    `Student ID: ${data.studentId}. ` +
    `Class: ${data.className}. ` +
    `Parent ID: ${data.parentId}. ` +
    `Parent Login: ${data.parentLoginEmail}. ` +
    `Parent Password: ${parentPassword}. ` +
    `Student Login: ${data.studentLoginEmail}. ` +
    `Student Password: ${data.studentTemporaryPassword}. ` +
    `Please keep these details secure.`;

  const response = await fetch(
    `${getTermiiBaseUrl()}/api/sms/send`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        to:
          data.parentPhone,

        from:
          getTermiiSenderId(),

        sms,

        type:
          "plain",

        channel:
          "dnd",

        api_key:
          apiKey,
      }),
    }
  );

  let result: any = null;

  try {
    result =
      await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `SMS provider returned HTTP ${response.status}.`
    );
  }

  return {
    sent: true,
  };
}

// =========================================================
// SEND BOTH ADMISSION NOTIFICATIONS
// =========================================================

async function sendAdmissionNotifications(
  data: AdmissionNotificationData
): Promise<{
  email: "sent" | "failed" | "skipped";
  sms: "sent" | "failed" | "skipped";
  errors: string[];
}> {
  let email:
    | "sent"
    | "failed"
    | "skipped" =
    data.parentEmail
      ? "failed"
      : "skipped";

  let sms:
    | "sent"
    | "failed"
    | "skipped" =
    data.parentPhone
      ? "failed"
      : "skipped";

  const errors: string[] = [];

  // -------------------------------------------------------
  // EMAIL
  // -------------------------------------------------------

  if (data.parentEmail) {
    try {
      const result =
        await sendAdmissionEmail(
          data
        );

      email =
        result.sent
          ? "sent"
          : "failed";

      if (
        !result.sent &&
        result.reason
      ) {
        errors.push(
          `Email: ${result.reason}`
        );
      }
    } catch (error) {
      email = "failed";

      errors.push(
        `Email: ${
          error instanceof Error
            ? error.message
            : "Unknown email error."
        }`
      );

      console.error(
        "Admission email notification failed:",
        error
      );
    }
  }

  // -------------------------------------------------------
  // SMS
  // -------------------------------------------------------

  if (data.parentPhone) {
    try {
      const result =
        await sendAdmissionSms(
          data
        );

      sms =
        result.sent
          ? "sent"
          : "failed";

      if (
        !result.sent &&
        result.reason
      ) {
        errors.push(
          `SMS: ${result.reason}`
        );
      }
    } catch (error) {
      sms = "failed";

      errors.push(
        `SMS: ${
          error instanceof Error
            ? error.message
            : "Unknown SMS error."
        }`
      );

      console.error(
        "Admission SMS notification failed:",
        error
      );
    }
  }

  return {
    email,
    sms,
    errors,
  };
}

// =========================================================
// PUBLIC ADMISSION APPLICATION SUBMISSION
// =========================================================
//
// POST /api/admissions/application
//
// Legacy alias:
// POST /api/admissions/apply
//
// The applicant does NOT need to be authenticated.
//
// IMPORTANT:
// The applicant never writes directly to Firebase RTDB.
// Firebase Admin SDK performs the write on the backend.
//
// =========================================================

router.post(
  [
    "/application",
    "/apply",
  ],

  async (
    req: any,
    res: Response
  ) => {
    try {
      const body =
        req.body || {};

      // -----------------------------------------------------
      // VALIDATE REQUIRED STUDENT INFORMATION
      // -----------------------------------------------------

      const studentFirstName =
        String(
          body.studentFirstName || ""
        ).trim();

      const studentMiddleName =
        String(
          body.studentMiddleName || ""
        ).trim();

      const studentLastName =
        String(
          body.studentLastName || ""
        ).trim();

      const dateOfBirth =
        String(
          body.dateOfBirth || ""
        ).trim();

      const gender =
        String(
          body.gender || ""
        ).trim();

      const classApplied =
        String(
          body.classApplied || ""
        ).trim();

      // -----------------------------------------------------
      // VALIDATE REQUIRED PARENT INFORMATION
      // -----------------------------------------------------

      const parentName =
        String(
          body.parentName || ""
        ).trim();

      const parentPhone =
        String(
          body.parentPhone || ""
        ).trim();

      const parentEmail =
        normalizeEmail(
          String(
            body.parentEmail || ""
          )
        );

      const relationship =
        String(
          body.relationship || ""
        ).trim();

      // -----------------------------------------------------
      // VALIDATE DECLARATION
      // -----------------------------------------------------

      if (
        body.declaration !== true
      ) {
        return res.status(400).json({
          success: false,

          message:
            "You must accept the declaration before submitting the application.",
        });
      }

      // -----------------------------------------------------
      // REQUIRED FIELD VALIDATION
      // -----------------------------------------------------

      if (!studentFirstName) {
        return res.status(400).json({
          success: false,

          message:
            "Student first name is required.",
        });
      }

      if (!studentLastName) {
        return res.status(400).json({
          success: false,

          message:
            "Student last name is required.",
        });
      }

      if (!dateOfBirth) {
        return res.status(400).json({
          success: false,

          message:
            "Student date of birth is required.",
        });
      }

      if (!gender) {
        return res.status(400).json({
          success: false,

          message:
            "Student gender is required.",
        });
      }

      if (!classApplied) {
        return res.status(400).json({
          success: false,

          message:
            "Class applied for is required.",
        });
      }

      if (!parentName) {
        return res.status(400).json({
          success: false,

          message:
            "Parent or guardian name is required.",
        });
      }

      if (!parentPhone) {
        return res.status(400).json({
          success: false,

          message:
            "Parent or guardian phone number is required.",
        });
      }

      if (!parentEmail) {
        return res.status(400).json({
          success: false,

          message:
            "Parent or guardian email address is required.",
        });
      }

      if (!relationship) {
        return res.status(400).json({
          success: false,

          message:
            "Parent or guardian relationship is required.",
        });
      }

      // -----------------------------------------------------
      // GENERATE SERVER-SIDE APPLICATION NUMBER
      // -----------------------------------------------------

      const applicationNumber =
        generateApplicationNumber();

      // -----------------------------------------------------
      // CREATE FIREBASE APPLICATION KEY
      // -----------------------------------------------------

      const applicationRef =
        adminDatabase
          .ref("admissions")
          .push();

      const applicationId =
        applicationRef.key;

      if (!applicationId) {
        throw new Error(
          "Unable to generate application ID."
        );
      }

      // -----------------------------------------------------
      // APPLICATION RECORD
      // -----------------------------------------------------

      const applicationData:
        AdmissionData & {
          previousSchool?: {
            name?: string;
            previousClass?: string;
          };

          declarationAccepted: boolean;
        } = {
          applicationId,

          applicationNumber,

          status:
            "pending",

          applicationFee:
            ADMISSION_FEE_NAIRA,

          paymentStatus:
            "unpaid",

          paymentAmount:
            0,

          paymentReference:
            "",

          paymentDate:
            "",

          paymentVerifiedAt:
            0,

          submittedAt:
            new Date().toISOString(),

          student: {
            firstName:
              studentFirstName,

            middleName:
              studentMiddleName,

            lastName:
              studentLastName,

            dateOfBirth,

            gender,

            classApplied,
          },

          parentGuardian: {
            name:
              parentName,

            phone:
              parentPhone,

            email:
              parentEmail,

            relationship,
          },

          previousSchool: {
            name:
              String(
                body.previousSchool || ""
              ).trim(),

            previousClass:
              String(
                body.previousClass || ""
              ).trim(),
          },

          emergencyContact: {
            name:
              String(
                body.emergencyName || ""
              ).trim(),

            phone:
              String(
                body.emergencyPhone || ""
              ).trim(),
          },

          additionalNotes:
            String(
              body.additionalNotes || ""
            ).trim(),

          declarationAccepted:
            true,
        };

      // -----------------------------------------------------
      // SAVE WITH FIREBASE ADMIN SDK
      // -----------------------------------------------------

      await applicationRef.set(
        applicationData
      );

      // -----------------------------------------------------
      // RETURN SAFE APPLICATION INFORMATION
      // -----------------------------------------------------

      return res.status(201).json({
        success: true,

        message:
          "Admission application submitted successfully.",

        applicationId,

        applicationNumber,

        applicationFee:
          ADMISSION_FEE_NAIRA,

        paymentStatus:
          "unpaid",
      });

    } catch (
      error: unknown
    ) {
      console.error(
        "Public admission application submission error:",
        error
      );

      const statusCode =
        getHttpStatus(error);

      return res.status(
        statusCode
      ).json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Unable to submit the admission application.",
      });
    }
  }
);

// =========================================================
// GET ADMISSION APPLICATION FOR PAYMENT
// =========================================================

router.get(
  "/payment/application/:applicationId",

  async (
    req: any,
    res: Response
  ) => {
    try {
      const applicationId =
        String(
          req.params.applicationId || ""
        ).trim();

      if (!applicationId) {
        return res.status(400).json({
          success: false,

          message:
            "Application ID is required.",
        });
      }

      const {
        data: application,
      } =
        await loadAdmission(
          applicationId
        );

      const student =
        application.student || {};

      const studentName =
        [
          student.firstName,
          student.middleName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      return res.status(200).json({
        success: true,

        application: {
          id:
            applicationId,

          applicationId,

          applicationNumber:
            String(
              application.applicationNumber ||
                ""
            ),

          status:
            String(
              application.status ||
                "pending"
            ),

          applicationFee:
            Number(
              application.applicationFee ||
                ADMISSION_FEE_NAIRA
            ),

          paymentStatus:
            String(
              application.paymentStatus ||
                "unpaid"
            ),

          paymentAmount:
            Number(
              application.paymentAmount ||
                0
            ),

          paymentReference:
            String(
              application.paymentReference ||
                ""
            ),

          paymentDate:
            String(
              application.paymentDate ||
                ""
            ),

          paymentVerifiedAt:
            Number(
              application.paymentVerifiedAt ||
                0
            ),

          studentName,

          classApplied:
            String(
              student.classApplied ||
                ""
            ),
        },
      });

    } catch (
      error: unknown
    ) {
      console.error(
        "Get admission payment application error:",
        error
      );

      const statusCode =
        Number(
          (error as any)?.statusCode
        ) ||
        (
          error instanceof Error &&
          error.message
            .toLowerCase()
            .includes("not found")
            ? 404
            : 500
        );

      return res.status(
        statusCode
      ).json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Unable to load the admission application.",
      });
    }
  }
);

// =========================================================
// INITIALIZE ADMISSION FEE PAYMENT
// =========================================================

router.post(
  "/payment/initialize",

  async (
    req: any,
    res: Response
  ) => {
    try {
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

      const {
        ref: applicationRef,
        data: application,
      } =
        await loadAdmission(
          applicationId
        );

      const currentStatus =
        String(
          application.status || "pending"
        ).toLowerCase();

      if (
        currentStatus === "approved"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This admission application has already been approved.",
        });
      }

      if (
        currentStatus === "rejected"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "A rejected admission application cannot receive a payment.",
        });
      }

      const existingPaymentStatus =
        String(
          application.paymentStatus ||
            "unpaid"
        ).toLowerCase();

      if (
        existingPaymentStatus ===
        "paid"
      ) {
        return res.status(200).json({
          success: true,

          message:
            "This admission application has already been paid.",

          applicationId,

          applicationFee:
            Number(
              application.applicationFee ||
                ADMISSION_FEE_NAIRA
            ),

          paymentStatus:
            "paid",

          reference:
            String(
              application.paymentReference ||
                ""
            ),

          alreadyPaid:
            true,
        });
      }

      const parent =
        application.parentGuardian || {};

      const email =
        normalizeEmail(
          String(
            parent.email || ""
          )
        );

      if (!email) {
        return res.status(400).json({
          success: false,

          message:
            "A valid parent/guardian email address is required for payment.",
        });
      }

      const applicationFee =
        Number(
          application.applicationFee ||
            ADMISSION_FEE_NAIRA
        );

      if (
        !Number.isFinite(
          applicationFee
        ) ||
        applicationFee <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid admission application fee.",
        });
      }

      const reference =
        createPaymentReference(
          applicationId
        );

      const student =
        application.student || {};

      const applicantName =
        [
          student.firstName,
          student.middleName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      const payload = {
        email,

        amount:
          String(
            Math.round(
              applicationFee * 100
            )
          ),

        currency:
          "NGN",

        reference,

        callback_url:
          getAdmissionPaymentCallbackUrl(
            applicationId
          ),

        metadata: {
          applicationId,

          applicationNumber:
            String(
              application.applicationNumber ||
                ""
            ),

          applicantName,

          paymentType:
            "admission_application_fee",
        },
      };

      const paystackResponse =
        await paystackRequest<PaystackInitializeResponse>(
          "/transaction/initialize",
          {
            method: "POST",

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const payment =
        paystackResponse.data;

      await applicationRef.update({
        paymentStatus:
          "pending",

        paymentAmount:
          applicationFee,

        paymentReference:
          payment.reference,

        paymentDate:
          "",

        paymentVerifiedAt:
          0,
      });

      return res.status(200).json({
        success: true,

        message:
          "Payment initialized successfully.",

        applicationId,

        applicationFee,

        amountKobo:
          Math.round(
            applicationFee * 100
          ),

        reference:
          payment.reference,

        accessCode:
          payment.access_code,

        authorizationUrl:
          payment.authorization_url,
      });

    } catch (
      error: unknown
    ) {
      console.error(
        "Initialize admission payment error:",
        error
      );

      const statusCode =
        getHttpStatus(error);

      return res.status(
        statusCode
      ).json({
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

router.get(
  "/payment/verify/:applicationId/:reference",

  async (
    req: any,
    res: Response
  ) => {
    try {
      const applicationId =
        String(
          req.params.applicationId ||
            ""
        ).trim();

      const reference =
        String(
          req.params.reference ||
            ""
        ).trim();

      if (
        !applicationId ||
        !reference
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Application ID and payment reference are required.",
        });
      }

      const result =
        await verifyAndRecordAdmissionPayment(
          applicationId,
          reference
        );

      return res.status(200).json({
        success: true,

        ...result,
      });

    } catch (error: unknown) {
      console.error(
        "Verify admission payment error:",
        error
      );

      const statusCode =
        Number(
          (error as any)?.statusCode
        ) ||
        (
          String(
            (error as any)?.message ||
              ""
          ).includes("not found")
            ? 404
            : 500
        );

      return res.status(
        statusCode
      ).json({
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

router.post(
  "/payment/webhook",

  async (
    req: any,
    res: Response
  ) => {
    try {
      const signature =
        String(
          req.headers[
            "x-paystack-signature"
          ] || ""
        ).trim();

      if (
        !verifyPaystackWebhookSignature(
          req.rawBody,
          signature
        )
      ) {
        console.warn(
          "Rejected invalid Paystack webhook signature."
        );

        return res.status(401).json({
          success: false,

          message:
            "Invalid webhook signature.",
        });
      }

      res.status(200).json({
        success: true,

        received: true,
      });

      const event =
        req.body || {};

      if (
        event.event !==
        "charge.success"
      ) {
        return;
      }

      const transaction =
        event.data || {};

      const reference =
        String(
          transaction.reference ||
            ""
        ).trim();

      if (!reference) {
        console.warn(
          "Paystack webhook did not contain a transaction reference."
        );

        return;
      }

      let applicationId =
        String(
          transaction.metadata
            ?.applicationId ||
          transaction.metadata
            ?.application_id ||
          ""
        ).trim();

      if (!applicationId) {
        const admissionsSnapshot =
          await adminDatabase
            .ref("admissions")
            .once("value");

        if (
          admissionsSnapshot.exists()
        ) {
          const admissions =
            admissionsSnapshot.val() as Record<
              string,
              AdmissionData
            >;

          for (
            const [
              id,
              admission,
            ] of Object.entries(
              admissions
            )
          ) {
            if (
              String(
                admission.paymentReference ||
                  ""
              ).trim() ===
              reference
            ) {
              applicationId =
                id;

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
      } catch (
        verificationError
      ) {
        console.error(
          "Admission payment webhook verification failed:",
          verificationError
        );
      }

    } catch (error) {
      console.error(
        "Paystack admission webhook error:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,

          message:
            "Webhook processing failed.",
        });
      }
    }
  }
);

// =========================================================
// APPROVE ADMISSION
// =========================================================

router.post(
  "/approve",

  requireAuth,
  requireAdminPermission("admissions"),

  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    let createdStudentUid:
      string | null = null;

    let createdParentUid:
      string | null = null;

    let parentAccountCreated =
      false;

    let databaseSaveCompleted =
      false;

    try {
      // ---------------------------------------------------
      // GET APPLICATION ID
      // ---------------------------------------------------

      const applicationId =
        String(
          req.body?.applicationId ||
            ""
        ).trim();

      if (!applicationId) {
        return res.status(400).json({
          success: false,

          message:
            "Application ID is required.",
        });
      }

      // ---------------------------------------------------
      // LOAD APPLICATION
      // ---------------------------------------------------

      const applicationRef =
        adminDatabase.ref(
          `admissions/${applicationId}`
        );

      const applicationSnapshot =
        await applicationRef.once(
          "value"
        );

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
        application.status ===
        "approved"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "This admission application has already been approved.",
        });
      }

      if (
        application.status ===
        "rejected"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "A rejected admission application cannot be approved.",
        });
      }

      // ===================================================
      // PAYMENT SECURITY CHECK
      // ===================================================

      const paymentStatus =
        String(
          application.paymentStatus ||
            "unpaid"
        ).toLowerCase();

      if (
        paymentStatus !==
        "paid"
      ) {
        return res.status(400).json({
          success: false,

          message:
            `Admission cannot be approved until the ₦${ADMISSION_FEE_NAIRA.toLocaleString(
              "en-NG"
            )} admission fee has been successfully paid and verified.`,

          paymentStatus,
        });
      }

      const paymentAmount =
        Number(
          application.paymentAmount ||
            0
        );

      const expectedAdmissionFee =
        Number(
          application.applicationFee ||
            ADMISSION_FEE_NAIRA
        );

      if (
        paymentAmount !==
        expectedAdmissionFee
      ) {
        return res.status(400).json({
          success: false,

          message:
            "The recorded admission payment amount does not match the required admission fee.",

          paymentStatus,

          paymentAmount,

          expectedAmount:
            expectedAdmissionFee,
        });
      }

      if (
        !String(
          application.paymentReference ||
            ""
        ).trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "A verified payment reference is required before admission can be approved.",
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
          String(
            parent.phone || ""
          )
        );

      const normalizedParentEmail =
        normalizeEmail(
          String(
            parent.email || ""
          )
        );

      if (!parentName) {
        return res.status(400).json({
          success: false,

          message:
            "Parent or guardian name is required.",
        });
      }

      if (
        !normalizedParentPhone
      ) {
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

      if (
        parentsSnapshot.exists()
      ) {
        const parents =
          parentsSnapshot.val() as Record<
            string,
            FirebaseRecord
          >;

        for (
          const [
            key,
            value,
          ] of Object.entries(
            parents
          )
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
          existingParent?.parentId ||
            ""
        ).trim();

      let parentUid =
        String(
          existingParent?.uid ||
            ""
        ).trim() || null;

      let parentTemporaryPassword:
        string | null = null;

      // ===================================================
      // CREATE PARENT RECORD ID
      // ===================================================

      if (!parentCode) {
        parentCode =
          await generateParentId();
      }

      // ===================================================
      // CREATE / FIND PARENT AUTH ACCOUNT
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

        } catch (
          error: unknown
        ) {
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

            parentTemporaryPassword =
              null;

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
        existingParent?.children &&
        typeof existingParent.children ===
          "object"
          ? (
              existingParent.children as FirebaseRecord
            )
          : {};

      const updatedChildren:
        FirebaseRecord = {
          ...existingChildren,
        };

      // ===================================================
      // CREATE / UPDATE PARENT RECORD
      // ===================================================

      const parentRecord:
        FirebaseRecord = {
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

      if (!studentFullName) {
        throw new Error(
          "Student name is required before approval."
        );
      }

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

      } catch (
        error: unknown
      ) {
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
          if (
            createdParentUid &&
            parentAccountCreated
          ) {
            try {
              await adminAuth.deleteUser(
                createdParentUid
              );
            } catch (
              cleanupError
            ) {
              console.error(
                "Failed to clean up parent Auth account after student account conflict:",
                cleanupError
              );
            }

            createdParentUid =
              null;
          }

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

      updatedChildren[
        studentUid
      ] = true;

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

      if (
        !firebaseStudentKey
      ) {
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

        parentId:
          parentUid,

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

        databaseSaveCompleted =
          true;

        createdStudentUid =
          null;

        createdParentUid =
          null;

      } catch (
        error
      ) {
        if (
          createdStudentUid
        ) {
          try {
            await adminAuth
              .deleteUser(
                createdStudentUid
              );
          } catch (
            cleanupError
          ) {
            console.error(
              "Failed to clean up student Auth account:",
              cleanupError
            );
          }
        }

        if (
          createdParentUid &&
          parentAccountCreated
        ) {
          try {
            await adminAuth
              .deleteUser(
                createdParentUid
              );
          } catch (
            cleanupError
          ) {
            console.error(
              "Failed to clean up parent Auth account:",
              cleanupError
            );
          }
        }

        throw error;
      }

      // ===================================================
      // PREPARE ADMISSION NOTIFICATION
      // ===================================================

      const notificationData:
        AdmissionNotificationData = {
        parentName,

        parentId:
          parentCode,

        parentEmail:
          normalizedParentEmail,

        parentPhone:
          normalizedParentPhone,

        parentLoginEmail:
          parentInternalEmail,

        parentTemporaryPassword,

        studentName:
          studentFullName,

        studentId,

        studentLoginEmail:
          studentInternalEmail,

        studentTemporaryPassword,

        className:
          String(
            student.classApplied ||
              ""
          ),
      };

      // ===================================================
      // SEND EMAIL + SMS
      // ===================================================

      const notificationResult =
        await sendAdmissionNotifications(
          notificationData
        );

      // ===================================================
      // SAVE NOTIFICATION STATUS
      // ===================================================

      const notificationAttemptTime =
        new Date().toISOString();

      const notificationUpdates: {
        [path: string]: unknown;
      } = {};

      notificationUpdates[
        `admissions/${applicationId}/notificationStatus/email`
      ] =
        notificationResult.email;

      notificationUpdates[
        `admissions/${applicationId}/notificationStatus/sms`
      ] =
        notificationResult.sms;

      notificationUpdates[
        `admissions/${applicationId}/notificationStatus/lastAttemptAt`
      ] =
        notificationAttemptTime;

      if (
        notificationResult.errors.length
      ) {
        notificationUpdates[
          `admissions/${applicationId}/notificationStatus/lastError`
        ] =
          notificationResult.errors.join(
            " | "
          );
      }

      if (
        notificationResult.email ===
          "sent" ||
        notificationResult.sms ===
          "sent"
      ) {
        notificationUpdates[
          `admissions/${applicationId}/notificationSentAt`
        ] =
          notificationAttemptTime;
      }

      try {
        await adminDatabase
          .ref()
          .update(
            notificationUpdates
          );
      } catch (
        notificationDatabaseError
      ) {
        console.error(
          "Failed to save admission notification status:",
          notificationDatabaseError
        );
      }

      // ===================================================
      // SUCCESS RESPONSE
      // ===================================================

      return res.status(200).json({
        success: true,

        applicationId,

        student: {
          studentId,

          uid:
            studentUid,

          temporaryPassword:
            studentTemporaryPassword,

          email:
            studentInternalEmail,
        },

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

        notifications: {
          email:
            notificationResult.email,

          sms:
            notificationResult.sms,

          errors:
            notificationResult.errors,
        },

        studentRecordId:
          firebaseStudentKey,

        parentRecordId:
          parentRecordKey,

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
          notificationResult.errors.length ===
          0
            ? (
                parentAccountCreated
                  ? "Admission approved successfully. Student and parent accounts were created and the admission notification was sent."
                  : "Admission approved successfully. Student account was created, the existing parent account was linked, and the admission notification was sent."
              )
            : (
                parentAccountCreated
                  ? "Admission approved successfully. Student and parent accounts were created, but one or more admission notifications could not be sent."
                  : "Admission approved successfully. Student account was created and the existing parent account was linked, but one or more admission notifications could not be sent."
              ),
      });

    } catch (
      error: unknown
    ) {
      console.error(
        "Approve admission error:",
        error
      );

      // Only clean up Auth accounts if the database
      // approval was NOT successfully committed.

      if (
        !databaseSaveCompleted &&
        createdStudentUid
      ) {
        try {
          await adminAuth.deleteUser(
            createdStudentUid
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to clean up student Auth account after approval failure:",
            cleanupError
          );
        }
      }

      if (
        !databaseSaveCompleted &&
        createdParentUid &&
        parentAccountCreated
      ) {
        try {
          await adminAuth.deleteUser(
            createdParentUid
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to clean up parent Auth account after approval failure:",
            cleanupError
          );
        }
      }

      const status =
        getHttpStatus(error);

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while approving the admission application.";

      return res.status(
        status
      ).json({
        success: false,

        message,
      });
    }
  }
);

export default router;