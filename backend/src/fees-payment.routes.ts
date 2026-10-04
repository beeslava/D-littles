import express, {
  Request,
  Response,
} from "express";

import crypto from "node:crypto";

import {
  requireAuth,
  AuthenticatedRequest,
} from "./auth-middleware.js";

import {
  adminDatabase,
} from "./firebase-admin.js";

const router = express.Router();

const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:4200";

const SCHOOL_FEE_CURRENCY = "NGN";

const PAYMENT_RESERVATION_MINUTES = 30;

/* =========================================================
   TYPES
========================================================= */

interface FeeStructure {
  id?: string;

  title?: string;
  description?: string;

  classId?: string;
  className?: string;

  accountNumber?: string;

  items?: Array<{
    name?: string;
    title?: string;
    description?: string;
    amount?: number;
  }>;

  totalAmount?: number;

  status?: string;

  createdAt?: string;
  updatedAt?: string;

  createdBy?: string;
  createdByName?: string;
}

interface StudentRecord {
  id?: string;

  uid?: string;
  userId?: string;
  studentUid?: string;

  studentId?: string;

  fullName?: string;
  name?: string;

  email?: string;

  classId?: string;
  className?: string;

  parentId?: string;
  parentUid?: string;

  status?: string;

  [key: string]: unknown;
}

interface SchoolUser {
  uid?: string;

  email?: string;

  fullName?: string;
  name?: string;

  role?: string;

  studentId?: string;
  studentRecordId?: string;

  parentId?: string;

  [key: string]: unknown;
}

interface PaymentRecord {
  id?: string;

  studentId?: string;
  studentRecordId?: string;
  studentUid?: string;

  parentId?: string;

  feeId?: string;
  feeTitle?: string;

  accountNumber?: string;

  amountPaid?: number;

  totalAmount?: number;
  totalFee?: number;

  balance?: number;

  paymentReference?: string;

  status?: string;
  paymentStatus?: string;

  paymentDate?: string;
  createdAt?: string;
  updatedAt?: string;

  payerUid?: string;
  payerRole?: string;

  currency?: string;

  paystackTransactionId?: number | string;

  channel?: string;

  gatewayResponse?: string;

  paidAt?: string;

  metadata?: Record<string, unknown>;

  [key: string]: unknown;
}

/* =========================================================
   HELPERS
========================================================= */

function nowIso(): string {
  return new Date().toISOString();
}

function generatePaymentId(): string {
  return `FEE-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function generatePaymentReference(): string {
  return `DLFEE-${Date.now()}-${crypto
    .randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

function normalizeNumber(
  value: unknown
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function normalizeString(
  value: unknown
): string {
  return String(value ?? "").trim();
}

function normalizeEmail(
  value: unknown
): string {
  return normalizeString(value).toLowerCase();
}

function getFeeTotal(
  fee: FeeStructure
): number {
  const totalAmount = normalizeNumber(
    fee.totalAmount
  );

  if (totalAmount > 0) {
    return totalAmount;
  }

  if (!Array.isArray(fee.items)) {
    return 0;
  }

  return fee.items.reduce(
    (total, item) =>
      total +
      normalizeNumber(item?.amount),
    0
  );
}

function getStudentName(
  student: StudentRecord
): string {
  return (
    normalizeString(student.fullName) ||
    normalizeString(student.name) ||
    "Student"
  );
}

function getStudentUid(
  student: StudentRecord
): string {
  return (
    normalizeString(student.uid) ||
    normalizeString(student.userId) ||
    normalizeString(student.studentUid)
  );
}

function getStudentParentUid(
  student: StudentRecord
): string {
  return (
    normalizeString(student.parentId) ||
    normalizeString(student.parentUid)
  );
}

function isSuccessfulPayment(
  payment: PaymentRecord
): boolean {
  const status =
    normalizeString(
      payment.status
    ).toLowerCase();

  const paymentStatus =
    normalizeString(
      payment.paymentStatus
    ).toLowerCase();

  return (
    status === "success" ||
    status === "successful" ||
    status === "paid" ||
    paymentStatus === "success" ||
    paymentStatus === "successful" ||
    paymentStatus === "paid"
  );
}

function isPendingPayment(
  payment: PaymentRecord
): boolean {
  const status =
    normalizeString(
      payment.status
    ).toLowerCase();

  const paymentStatus =
    normalizeString(
      payment.paymentStatus
    ).toLowerCase();

  return (
    status === "pending" ||
    paymentStatus === "pending"
  );
}

/* =========================================================
   FIREBASE HELPERS
========================================================= */

async function getUserByUid(
  uid: string
): Promise<SchoolUser | null> {
  const snapshot =
    await adminDatabase
      .ref(`users/${uid}`)
      .once("value");

  if (!snapshot.exists()) {
    return null;
  }

  return {
    uid,
    ...(snapshot.val() || {}),
  };
}

async function getStudentByRecordId(
  studentRecordId: string
): Promise<StudentRecord | null> {
  const snapshot =
    await adminDatabase
      .ref(`students/${studentRecordId}`)
      .once("value");

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: studentRecordId,
    ...(snapshot.val() || {}),
  };
}

async function getFeeById(
  feeId: string
): Promise<FeeStructure | null> {
  const snapshot =
    await adminDatabase
      .ref(`fees/${feeId}`)
      .once("value");

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: feeId,
    ...(snapshot.val() || {}),
  };
}

async function getAllPayments(): Promise<
  Record<string, PaymentRecord>
> {
  const snapshot =
    await adminDatabase
      .ref("payments")
      .once("value");

  if (!snapshot.exists()) {
    return {};
  }

  return snapshot.val() || {};
}

/* =========================================================
   PAYMENT TOTALS
========================================================= */

async function getFeePaymentTotals(
  feeId: string,
  studentRecordId: string
): Promise<{
  paid: number;
  pending: number;
}> {
  const payments =
    await getAllPayments();

  let paid = 0;
  let pending = 0;

  const currentTime =
    Date.now();

  for (const payment of Object.values(
    payments
  )) {
    if (!payment) {
      continue;
    }

    const paymentFeeId =
      normalizeString(
        payment.feeId
      );

    const paymentStudentRecordId =
      normalizeString(
        payment.studentRecordId
      );

    if (
      paymentFeeId !== feeId ||
      paymentStudentRecordId !==
        studentRecordId
    ) {
      continue;
    }

    const amount =
      normalizeNumber(
        payment.amountPaid
      );

    if (amount <= 0) {
      continue;
    }

    if (
      isSuccessfulPayment(payment)
    ) {
      paid += amount;
      continue;
    }

    if (
      isPendingPayment(payment)
    ) {
      const metadata =
        payment.metadata || {};

      const expiresAt =
        normalizeNumber(
          metadata.expiresAt
        );

      if (
        expiresAt > 0 &&
        expiresAt < currentTime
      ) {
        continue;
      }

      pending += amount;
    }
  }

  return {
    paid,
    pending,
  };
}

/* =========================================================
   AUTHORIZATION
========================================================= */

async function authorizeStudentPayment(
  req: AuthenticatedRequest,
  studentRecordId: string
): Promise<{
  allowed: boolean;
  message?: string;
  user?: SchoolUser;
  student?: StudentRecord;
  role?: string;
}> {
  const uid =
    req.user?.uid;

  if (!uid) {
    return {
      allowed: false,
      message:
        "Authenticated user was not found.",
    };
  }

  const user =
    await getUserByUid(uid);

  if (!user) {
    return {
      allowed: false,
      message:
        "School user account could not be found.",
    };
  }

  const student =
    await getStudentByRecordId(
      studentRecordId
    );

  if (!student) {
    return {
      allowed: false,
      message:
        "Student record could not be found.",
    };
  }

  const role =
    normalizeString(
      user.role
    ).toLowerCase();

  /* =======================================================
     STUDENT
  ======================================================= */

  if (role === "student") {
    const studentUserUid =
      getStudentUid(student);

    const userStudentRecordId =
      normalizeString(
        user.studentRecordId
      );

    const userStudentId =
      normalizeString(
        user.studentId
      );

    const studentPublicId =
      normalizeString(
        student.studentId
      );

    if (
      studentUserUid === uid ||
      userStudentRecordId ===
        studentRecordId ||
      (
        userStudentId &&
        studentPublicId &&
        userStudentId ===
          studentPublicId
      )
    ) {
      return {
        allowed: true,
        user,
        student,
        role,
      };
    }

    return {
      allowed: false,
      message:
        "You are not authorized to make a payment for this student.",
    };
  }

  /* =======================================================
     PARENT
  ======================================================= */

  if (role === "parent") {
    const parentUid =
      getStudentParentUid(student);

    if (
      parentUid === uid
    ) {
      return {
        allowed: true,
        user,
        student,
        role,
      };
    }

    return {
      allowed: false,
      message:
        "You are not authorized to make a payment for this student.",
    };
  }

  return {
    allowed: false,
    message:
      "Only students and parents can make school fee payments.",
  };
}

/* =========================================================
   PAYSTACK HELPERS
========================================================= */

async function paystackRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured."
    );
  }

  const response =
    await fetch(
      `https://api.paystack.co${endpoint}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${PAYSTACK_SECRET_KEY}`,

          "Content-Type":
            "application/json",

          ...(options.headers || {}),
        },
      }
    );

  let data: any = {};

  try {
    data =
      await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Paystack request failed."
    );
  }

  return data;
}

/* =========================================================
   POST /api/fees/payment/initialize
========================================================= */

router.post(
  "/payment/initialize",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    let paymentId = "";

    try {
      const {
        feeId,
        studentRecordId,
        amount,
      } = req.body || {};

      const cleanFeeId =
        normalizeString(feeId);

      const cleanStudentRecordId =
        normalizeString(
          studentRecordId
        );

      if (!cleanFeeId) {
        res.status(400).json({
          success: false,
          message:
            "Fee ID is required.",
        });
        return;
      }

      if (!cleanStudentRecordId) {
        res.status(400).json({
          success: false,
          message:
            "Student record ID is required.",
        });
        return;
      }

      const paymentAmount =
        normalizeNumber(amount);

      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "A valid payment amount is required.",
        });
        return;
      }

      const authorization =
        await authorizeStudentPayment(
          req,
          cleanStudentRecordId
        );

      if (!authorization.allowed) {
        res.status(403).json({
          success: false,
          message:
            authorization.message ||
            "You are not authorized to make this payment.",
        });
        return;
      }

      const student =
        authorization.student!;

      const fee =
        await getFeeById(
          cleanFeeId
        );

      if (!fee) {
        res.status(404).json({
          success: false,
          message:
            "School fee structure was not found.",
        });
        return;
      }

      const feeStatus =
        normalizeString(
          fee.status
        ).toLowerCase();

      if (
        feeStatus &&
        feeStatus !== "active"
      ) {
        res.status(400).json({
          success: false,
          message:
            "This school fee is not currently available for payment.",
        });
        return;
      }

      const totalFee =
        getFeeTotal(fee);

      if (totalFee <= 0) {
        res.status(400).json({
          success: false,
          message:
            "The selected school fee has no valid amount.",
        });
        return;
      }

      /* =====================================================
         CLASS VALIDATION
      ===================================================== */

      const feeClassId =
        normalizeString(
          fee.classId
        );

      const feeClassName =
        normalizeString(
          fee.className
        );

      const studentClassId =
        normalizeString(
          student.classId
        );

      const studentClassName =
        normalizeString(
          student.className
        );

      if (
        feeClassId &&
        studentClassId &&
        feeClassId !==
          studentClassId
      ) {
        res.status(400).json({
          success: false,
          message:
            "This fee structure does not belong to the student's class.",
        });
        return;
      }

      if (
        !feeClassId &&
        feeClassName &&
        studentClassName &&
        feeClassName.toLowerCase() !==
          studentClassName.toLowerCase()
      ) {
        res.status(400).json({
          success: false,
          message:
            "This fee structure does not belong to the student's class.",
        });
        return;
      }

      /* =====================================================
         EXISTING PAYMENT TOTALS
      ===================================================== */

      const totals =
        await getFeePaymentTotals(
          cleanFeeId,
          cleanStudentRecordId
        );

      const availableBalance =
        Math.max(
          0,
          totalFee -
            totals.paid -
            totals.pending
        );

      if (
        availableBalance <= 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "This school fee has already been fully paid or has a pending payment.",
          totalFee,
          totalPaid:
            totals.paid,
          pendingAmount:
            totals.pending,
          balance: 0,
        });
        return;
      }

      if (
        paymentAmount >
        availableBalance
      ) {
        res.status(400).json({
          success: false,
          message:
            "Payment amount cannot be greater than the remaining balance.",
          totalFee,
          totalPaid:
            totals.paid,
          pendingAmount:
            totals.pending,
          balance:
            availableBalance,
          requestedAmount:
            paymentAmount,
        });
        return;
      }

      /* =====================================================
         PAYER
      ===================================================== */

      const payerUid =
        normalizeString(
          req.user?.uid
        );

      if (!payerUid) {
        res.status(401).json({
          success: false,
          message:
            "Authenticated payer could not be identified.",
        });
        return;
      }

      const payerEmail =
        normalizeEmail(
          req.user?.email
        ) ||
        normalizeEmail(
          authorization.user?.email
        );

      if (!payerEmail) {
        res.status(400).json({
          success: false,
          message:
            "Your account does not have a valid email address for Paystack checkout.",
        });
        return;
      }

      /* =====================================================
         PAYMENT IDENTIFIERS
      ===================================================== */

      paymentId =
        generatePaymentId();

      const reference =
        generatePaymentReference();

      const createdAt =
        nowIso();

      const expiresAt =
        Date.now() +
        PAYMENT_RESERVATION_MINUTES *
          60 *
          1000;

      /* =====================================================
         NORMALIZED OPTIONAL FIELDS

         IMPORTANT:
         Firebase Realtime Database does NOT accept
         undefined values.

         Therefore we only add optional properties
         when they actually contain a value.
      ===================================================== */

      const studentId =
        normalizeString(
          student.studentId
        );

      const studentUid =
        getStudentUid(
          student
        );

      const parentId =
        getStudentParentUid(
          student
        );

      const feeTitle =
        normalizeString(
          fee.title
        ) ||
        "School Fees";

      const accountNumber =
        normalizeString(
          fee.accountNumber
        );

      /* =====================================================
         PAYMENT RECORD
      ===================================================== */

      const paymentRecord:
        PaymentRecord = {
          id:
            paymentId,

          studentRecordId:
            cleanStudentRecordId,

          feeId:
            cleanFeeId,

          feeTitle:
            feeTitle,

          amountPaid:
            paymentAmount,

          totalAmount:
            totalFee,

          totalFee:
            totalFee,

          balance:
            Math.max(
              0,
              totalFee -
                totals.paid -
                paymentAmount
            ),

          paymentReference:
            reference,

          status:
            "pending",

          paymentStatus:
            "pending",

          paymentDate:
            createdAt,

          createdAt:
            createdAt,

          updatedAt:
            createdAt,

          payerUid:
            payerUid,

          payerRole:
            authorization.role ||
            "unknown",

          currency:
            SCHOOL_FEE_CURRENCY,

          channel:
            "paystack",

          metadata: {
            expiresAt,

            studentName:
              getStudentName(
                student
              ),

            payerEmail,

            reservationMinutes:
              PAYMENT_RESERVATION_MINUTES,
          },
        };

      /*
       * Only add optional Firebase fields when
       * they contain real values.
       *
       * This prevents:
       *
       * "value argument contains undefined"
       */

      if (studentId) {
        paymentRecord.studentId =
          studentId;
      }

      if (studentUid) {
        paymentRecord.studentUid =
          studentUid;
      }

      if (parentId) {
        paymentRecord.parentId =
          parentId;
      }

      if (accountNumber) {
        paymentRecord.accountNumber =
          accountNumber;
      }

      /* =====================================================
         SAVE PENDING PAYMENT
      ===================================================== */

      await adminDatabase
        .ref(
          `payments/${paymentId}`
        )
        .set(
          paymentRecord
        );

      /* =====================================================
         INITIALIZE PAYSTACK
      ===================================================== */

      try {
        const paystackResponse =
          await paystackRequest(
            "/transaction/initialize",
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  email:
                    payerEmail,

                  amount:
                    Math.round(
                      paymentAmount *
                        100
                    ),

                  currency:
                    SCHOOL_FEE_CURRENCY,

                  reference,

                  callback_url:
                    `${FRONTEND_URL}/parent/fees/payment/${paymentId}`,

                  metadata: {
                    paymentId,

                    feeId:
                      cleanFeeId,

                    studentRecordId:
                      cleanStudentRecordId,

                    studentId:
                      studentId ||
                      null,

                    payerUid,

                    payerRole:
                      authorization.role ||
                      "unknown",

                    feeTitle:
                      feeTitle,
                  },
                }),
            }
          );

        if (
          !paystackResponse?.status ||
          !paystackResponse?.data
        ) {
          throw new Error(
            paystackResponse?.message ||
              "Paystack could not initialize the transaction."
          );
        }

        const authorizationUrl =
          normalizeString(
            paystackResponse
              .data
              ?.authorization_url
          );

        const accessCode =
          normalizeString(
            paystackResponse
              .data
              ?.access_code
          );

        if (!authorizationUrl) {
          throw new Error(
            "Paystack did not return a checkout authorization URL."
          );
        }

        const updatedMetadata:
          Record<string, unknown> = {
            ...(paymentRecord.metadata ||
              {}),

            expiresAt,

            studentName:
              getStudentName(
                student
              ),

            payerEmail,

            reservationMinutes:
              PAYMENT_RESERVATION_MINUTES,

            authorizationUrl,
          };

        if (accessCode) {
          updatedMetadata.paystackAccessCode =
            accessCode;
        }

        await adminDatabase
          .ref(
            `payments/${paymentId}`
          )
          .update({
            updatedAt:
              nowIso(),

            metadata:
              updatedMetadata,
          });

        res.json({
          success: true,

          message:
            "School fee payment initialized successfully.",

          paymentId,

          reference,

          authorizationUrl,

          accessCode:
            accessCode || null,

          amount:
            paymentAmount,

          currency:
            SCHOOL_FEE_CURRENCY,

          totalFee,

          totalPaid:
            totals.paid,

          pendingAmount:
            totals.pending,

          balance:
            Math.max(
              0,
              totalFee -
                totals.paid -
                paymentAmount
            ),
        });
      } catch (paystackError) {
        console.error(
          "Paystack initialization error:",
          paystackError
        );

        await adminDatabase
          .ref(
            `payments/${paymentId}`
          )
          .update({
            status:
              "failed",

            paymentStatus:
              "failed",

            updatedAt:
              nowIso(),

            gatewayResponse:
              paystackError instanceof
              Error
                ? paystackError.message
                : "Paystack initialization failed.",
          });

        throw paystackError;
      }
    } catch (error) {
      console.error(
        "School fee payment initialization error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to initialize school fee payment.",
        paymentId:
          paymentId || null,
      });
    }
  }
);

/* =========================================================
   VERIFY PAYMENT
   GET /api/fees/payment/verify/:paymentId/:reference
========================================================= */

router.get(
  "/payment/verify/:paymentId/:reference",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const paymentId =
        normalizeString(
          req.params.paymentId
        );

      const reference =
        normalizeString(
          req.params.reference
        );

      if (
        !paymentId ||
        !reference
      ) {
        res.status(400).json({
          success: false,
          message:
            "Payment ID and reference are required.",
        });
        return;
      }

      const paymentSnapshot =
        await adminDatabase
          .ref(
            `payments/${paymentId}`
          )
          .once("value");

      if (
        !paymentSnapshot.exists()
      ) {
        res.status(404).json({
          success: false,
          message:
            "Payment record was not found.",
        });
        return;
      }

      const payment:
        PaymentRecord =
        paymentSnapshot.val();

      const storedReference =
        normalizeString(
          payment.paymentReference
        );

      if (
        storedReference !==
        reference
      ) {
        res.status(400).json({
          success: false,
          message:
            "Payment reference does not match the payment record.",
        });
        return;
      }

      /* =====================================================
         AUTHORIZATION
      ===================================================== */

      const uid =
        normalizeString(
          req.user?.uid
        );

      const payerUid =
        normalizeString(
          payment.payerUid
        );

      let isAdmin =
        false;

      if (uid) {
        const user =
          await getUserByUid(
            uid
          );

        isAdmin =
          normalizeString(
            user?.role
          ).toLowerCase() ===
          "admin";
      }

      if (
        uid !== payerUid &&
        !isAdmin
      ) {
        res.status(403).json({
          success: false,
          message:
            "You are not authorized to verify this payment.",
        });
        return;
      }

      /* =====================================================
         ALREADY SUCCESSFUL
      ===================================================== */

      if (
        isSuccessfulPayment(
          payment
        )
      ) {
        res.json({
          success: true,
          verified: true,

          message:
            "Payment has already been verified.",

          payment: {
            paymentId,

            reference,

            status:
              payment.status,

            paymentStatus:
              payment.paymentStatus,

            amountPaid:
              payment.amountPaid,

            totalFee:
              payment.totalAmount ||
              payment.totalFee,

            balance:
              payment.balance,

            paymentDate:
              payment.paymentDate,

            studentId:
              payment.studentId,

            studentRecordId:
              payment.studentRecordId,

            feeId:
              payment.feeId,

            feeTitle:
              payment.feeTitle,
          },
        });

        return;
      }

      /* =====================================================
         PAYSTACK VERIFICATION
      ===================================================== */

      const paystackResponse =
        await paystackRequest(
          `/transaction/verify/${encodeURIComponent(
            reference
          )}`
        );

      const transaction =
        paystackResponse?.data;

      if (!transaction) {
        res.status(502).json({
          success: false,
          message:
            "Paystack returned an invalid verification response.",
        });
        return;
      }

      const transactionStatus =
        normalizeString(
          transaction.status
        ).toLowerCase();

      const transactionAmountNaira =
        normalizeNumber(
          transaction.amount
        ) / 100;

      const expectedAmount =
        normalizeNumber(
          payment.amountPaid
        );

      const transactionCurrency =
        normalizeString(
          transaction.currency
        ).toUpperCase();

      /* =====================================================
         AMOUNT + CURRENCY VALIDATION
      ===================================================== */

      const amountMatches =
        Math.abs(
          transactionAmountNaira -
            expectedAmount
        ) < 0.01;

      const currencyMatches =
        !transactionCurrency ||
        transactionCurrency ===
          SCHOOL_FEE_CURRENCY;

      if (
        transactionStatus !==
          "success" ||
        !amountMatches ||
        !currencyMatches
      ) {
        const failureStatus =
          transactionStatus ===
          "failed"
            ? "failed"
            : "pending";

        let gatewayResponse =
          normalizeString(
            transaction.gateway_response
          ) ||
          transactionStatus;

        if (!amountMatches) {
          gatewayResponse =
            "Paystack amount mismatch.";
        }

        if (!currencyMatches) {
          gatewayResponse =
            "Paystack currency mismatch.";
        }

        const failedUpdate:
          Record<string, unknown> = {
            status:
              failureStatus,

            paymentStatus:
              failureStatus,

            updatedAt:
              nowIso(),

            gatewayResponse,
          };

        if (
          transaction.id !==
          undefined &&
          transaction.id !==
          null
        ) {
          failedUpdate.paystackTransactionId =
            transaction.id;
        }

        await adminDatabase
          .ref(
            `payments/${paymentId}`
          )
          .update(
            failedUpdate
          );

        res.status(400).json({
          success: false,
          verified: false,

          message:
            transactionStatus ===
            "failed"
              ? "Paystack reports that this payment failed."
              : !amountMatches
                ? "The Paystack payment amount does not match the expected school fee payment."
                : !currencyMatches
                  ? "The Paystack payment currency does not match the expected currency."
                  : "Payment has not been successfully completed.",

          status:
            transactionStatus,

          amount:
            transactionAmountNaira,

          expectedAmount,

          currency:
            transactionCurrency ||
            null,

          expectedCurrency:
            SCHOOL_FEE_CURRENCY,
        });

        return;
      }

      /* =====================================================
         RE-CALCULATE TOTALS
      ===================================================== */

      const totals =
        await getFeePaymentTotals(
          normalizeString(
            payment.feeId
          ),
          normalizeString(
            payment.studentRecordId
          )
        );

      const fee =
        await getFeeById(
          normalizeString(
            payment.feeId
          )
        );

      const totalFee =
        fee
          ? getFeeTotal(fee)
          : normalizeNumber(
              payment.totalAmount ||
                payment.totalFee
            );

      const finalBalance =
        Math.max(
          0,
          totalFee -
            totals.paid -
            expectedAmount
        );

      const paidAt =
        normalizeString(
          transaction.paid_at
        ) ||
        nowIso();

      const verifiedAt =
        nowIso();

      const successfulUpdate:
        Record<string, unknown> = {
          status:
            "success",

          paymentStatus:
            "paid",

          paymentDate:
            paidAt,

          paidAt,

          updatedAt:
            verifiedAt,

          balance:
            finalBalance,

          channel:
            normalizeString(
              transaction.channel
            ) ||
            "paystack",

          gatewayResponse:
            normalizeString(
              transaction.gateway_response
            ) ||
            "Successful",

          metadata: {
            ...(payment.metadata ||
              {}),

            paystackStatus:
              transactionStatus,

            verifiedAt,

            transactionCurrency:
              transactionCurrency ||
              SCHOOL_FEE_CURRENCY,
          },
        };

      if (
        transaction.id !==
        undefined &&
        transaction.id !==
        null
      ) {
        successfulUpdate.paystackTransactionId =
          transaction.id;
      }

      await adminDatabase
        .ref(
          `payments/${paymentId}`
        )
        .update(
          successfulUpdate
        );

      res.json({
        success: true,
        verified: true,

        message:
          "School fee payment verified successfully.",

        payment: {
          paymentId,

          reference,

          status:
            "success",

          paymentStatus:
            "paid",

          amountPaid:
            expectedAmount,

          totalFee,

          totalPaid:
            totals.paid +
            expectedAmount,

          balance:
            finalBalance,

          paymentDate:
            paidAt,

          studentId:
            payment.studentId,

          studentRecordId:
            payment.studentRecordId,

          feeId:
            payment.feeId,

          feeTitle:
            payment.feeTitle,
        },
      });
    } catch (error) {
      console.error(
        "School fee payment verification error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify school fee payment.",
      });
    }
  }
);

/* =========================================================
   PAYSTACK WEBHOOK
   POST /api/fees/payment/webhook
========================================================= */

router.post(
  "/payment/webhook",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      if (!PAYSTACK_SECRET_KEY) {
        console.error(
          "PAYSTACK_SECRET_KEY is not configured."
        );

        res.status(500).json({
          success: false,
          message:
            "Payment gateway is not configured.",
        });

        return;
      }

      const signature =
        req.headers[
          "x-paystack-signature"
        ];

      if (
        typeof signature !==
        "string"
      ) {
        res.status(401).json({
          success: false,
          message:
            "Paystack signature is missing.",
        });

        return;
      }

      const rawBody =
        (
          req as Request & {
            rawBody?: Buffer;
          }
        ).rawBody;

      if (!rawBody) {
        res.status(400).json({
          success: false,
          message:
            "Raw webhook body is unavailable.",
        });

        return;
      }

      /* =====================================================
         VERIFY HMAC SIGNATURE
      ===================================================== */

      const expectedSignature =
        crypto
          .createHmac(
            "sha512",
            PAYSTACK_SECRET_KEY
          )
          .update(rawBody)
          .digest("hex");

      const signatureBuffer =
        Buffer.from(
          signature,
          "utf8"
        );

      const expectedSignatureBuffer =
        Buffer.from(
          expectedSignature,
          "utf8"
        );

      /*
       * crypto.timingSafeEqual()
       * throws if the two buffers
       * have different lengths.
       *
       * Check lengths first.
       */

      const signaturesMatch =
        signatureBuffer.length ===
          expectedSignatureBuffer.length &&
        crypto.timingSafeEqual(
          signatureBuffer,
          expectedSignatureBuffer
        );

      if (!signaturesMatch) {
        res.status(401).json({
          success: false,
          message:
            "Invalid Paystack webhook signature.",
        });

        return;
      }

      const event =
        req.body || {};

      const eventName =
        normalizeString(
          event.event
        ).toLowerCase();

      /* =====================================================
         ONLY PROCESS charge.success
      ===================================================== */

      if (
        eventName !==
        "charge.success"
      ) {
        res.status(200).json({
          success: true,
          message:
            "Webhook received.",
        });

        return;
      }

      const transaction =
        event.data || {};

      const reference =
        normalizeString(
          transaction.reference
        );

      if (!reference) {
        res.status(200).json({
          success: true,
          message:
            "Webhook received without a reference.",
        });

        return;
      }

      /* =====================================================
         FIND PAYMENT BY REFERENCE
      ===================================================== */

      const paymentQuery =
        await adminDatabase
          .ref("payments")
          .orderByChild(
            "paymentReference"
          )
          .equalTo(reference)
          .once("value");

      if (
        !paymentQuery.exists()
      ) {
        console.warn(
          `School fee payment not found for Paystack reference: ${reference}`
        );

        res.status(200).json({
          success: true,
          message:
            "Webhook received. Payment record not found.",
        });

        return;
      }

      const payments =
        paymentQuery.val() ||
        {};

      const entries =
        Object.entries(
          payments
        );

      const [
        paymentId,
        existingPayment,
      ] = entries[0] as [
        string,
        PaymentRecord
      ];

      /* =====================================================
         ALREADY PROCESSED
      ===================================================== */

      if (
        isSuccessfulPayment(
          existingPayment
        )
      ) {
        res.status(200).json({
          success: true,
          message:
            "Payment was already processed.",
        });

        return;
      }

      /* =====================================================
         AMOUNT VALIDATION
      ===================================================== */

      const expectedAmount =
        normalizeNumber(
          existingPayment.amountPaid
        );

      const transactionAmountNaira =
        normalizeNumber(
          transaction.amount
        ) / 100;

      const amountMatches =
        Math.abs(
          transactionAmountNaira -
            expectedAmount
        ) < 0.01;

      const transactionCurrency =
        normalizeString(
          transaction.currency
        ).toUpperCase();

      const currencyMatches =
        !transactionCurrency ||
        transactionCurrency ===
          SCHOOL_FEE_CURRENCY;

      if (
        !amountMatches ||
        !currencyMatches
      ) {
        console.error(
          "Paystack webhook validation failed:",
          {
            reference,
            expectedAmount,
            transactionAmountNaira,
            transactionCurrency,
            expectedCurrency:
              SCHOOL_FEE_CURRENCY,
          }
        );

        const gatewayResponse =
          !amountMatches
            ? "Paystack webhook amount mismatch."
            : "Paystack webhook currency mismatch.";

        await adminDatabase
          .ref(
            `payments/${paymentId}`
          )
          .update({
            status:
              "failed",

            paymentStatus:
              "failed",

            updatedAt:
              nowIso(),

            gatewayResponse,
          });

        res.status(200).json({
          success: true,
          message:
            "Webhook received but payment validation failed.",
        });

        return;
      }

      /* =====================================================
         CALCULATE FINAL BALANCE
      ===================================================== */

      const totals =
        await getFeePaymentTotals(
          normalizeString(
            existingPayment.feeId
          ),
          normalizeString(
            existingPayment.studentRecordId
          )
        );

      const fee =
        await getFeeById(
          normalizeString(
            existingPayment.feeId
          )
        );

      const totalFee =
        fee
          ? getFeeTotal(fee)
          : normalizeNumber(
              existingPayment.totalAmount ||
                existingPayment.totalFee
            );

      const finalBalance =
        Math.max(
          0,
          totalFee -
            totals.paid -
            expectedAmount
        );

      const paidAt =
        normalizeString(
          transaction.paid_at
        ) ||
        nowIso();

      const verifiedAt =
        nowIso();

      /* =====================================================
         UPDATE PAYMENT
      ===================================================== */

      const successfulUpdate:
        Record<string, unknown> = {
          status:
            "success",

          paymentStatus:
            "paid",

          paymentDate:
            paidAt,

          paidAt,

          balance:
            finalBalance,

          updatedAt:
            verifiedAt,

          channel:
            normalizeString(
              transaction.channel
            ) ||
            "paystack",

          gatewayResponse:
            normalizeString(
              transaction.gateway_response
            ) ||
            "Successful",

          metadata: {
            ...(existingPayment.metadata ||
              {}),

            webhookEvent:
              eventName,

            verifiedAt,

            transactionCurrency:
              transactionCurrency ||
              SCHOOL_FEE_CURRENCY,
          },
        };

      if (
        transaction.id !==
        undefined &&
        transaction.id !==
        null
      ) {
        successfulUpdate.paystackTransactionId =
          transaction.id;
      }

      await adminDatabase
        .ref(
          `payments/${paymentId}`
        )
        .update(
          successfulUpdate
        );

      console.log(
        `School fee payment verified by Paystack webhook: ${reference}`
      );

      res.status(200).json({
        success: true,
        message:
          "School fee payment webhook processed successfully.",
      });
    } catch (error) {
      console.error(
        "School fee Paystack webhook error:",
        error
      );

      /*
       * Keep HTTP 200 so Paystack does not
       * continuously retry a webhook that has
       * already been received.
       */
      res.status(200).json({
        success: false,
        message:
          "Webhook received.",
      });
    }
  }
);

/* =========================================================
   PAYMENT CALLBACK
   GET /api/fees/payment/callback/:paymentId
========================================================= */

router.get(
  "/payment/callback/:paymentId",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const paymentId =
        normalizeString(
          req.params.paymentId
        );

      const reference =
        normalizeString(
          req.query.reference ||
            req.query.trxref
        );

      if (
        !paymentId ||
        !reference
      ) {
        res.redirect(
          `${FRONTEND_URL}/parent/fees?payment=failed`
        );

        return;
      }

      res.redirect(
        `${FRONTEND_URL}/parent/fees/payment/${encodeURIComponent(
          paymentId
        )}?reference=${encodeURIComponent(
          reference
        )}`
      );
    } catch (error) {
      console.error(
        "School fee payment callback error:",
        error
      );

      res.redirect(
        `${FRONTEND_URL}/parent/fees?payment=failed`
      );
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;

