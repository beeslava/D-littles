import "dotenv/config";

import "./firebase-admin.js";

import express, {
  Request,
  Response,
  NextFunction
} from "express";

import cors from "cors";

import {
  requireAuth,
  AuthenticatedRequest
} from "./auth-middleware.js";

import admissionRoutes from "./admission-routes.js";
import staffRoutes from "./staff-routes.js";


// =========================================================
// TYPES
// =========================================================

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}


// =========================================================
// APP
// =========================================================

const app = express();


// =========================================================
// PORT
// =========================================================

const PORT =
  Number(process.env.PORT) || 10000;


// =========================================================
// MIDDLEWARE
// =========================================================

// ---------------------------------------------------------
// CORS
// ---------------------------------------------------------

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);


// ---------------------------------------------------------
// JSON BODY PARSER
// ---------------------------------------------------------
//
// IMPORTANT:
//
// Paystack signs the ORIGINAL webhook request body.
//
// We therefore keep a copy of the raw request body before
// Express parses it into req.body.
//
// This allows admission-routes.ts to verify:
//
// x-paystack-signature
//
// using HMAC SHA512.
//
// ---------------------------------------------------------

app.use(
  express.json({
    verify: (
      req: Request,
      _res: Response,
      buf: Buffer
    ) => {

      const request =
        req as RequestWithRawBody;

      request.rawBody =
        Buffer.from(buf);

    },
  })
);


// =========================================================
// ADMISSION ROUTES
// =========================================================
//
// Base URL:
//
// /api/admissions
//
// Examples:
//
// POST /api/admissions/approve
//
// POST /api/admissions/payment/initialize
//
// GET
// /api/admissions/payment/verify/:applicationId/:reference
//
// POST /api/admissions/payment/webhook
//
// =========================================================

app.use(
  "/api/admissions",
  admissionRoutes
);


// =========================================================
// STAFF ROUTES
// =========================================================
//
// Base URL:
//
// /api/staff
//
// Example:
//
// POST /api/staff/create
//
// Requires:
//
// Authorization: Bearer <firebase-id-token>
//
// Only authenticated administrators can create staff
// accounts.
//
// =========================================================

app.use(
  "/api/staff",
  staffRoutes
);


// =========================================================
// PUBLIC ROUTES
// =========================================================

// ---------------------------------------------------------
// ROOT
// ---------------------------------------------------------

app.get(
  "/",
  (_req: Request, res: Response) => {

    res.json({

      success: true,

      message:
        "D-Littles backend is running.",

    });

  }
);


// ---------------------------------------------------------
// HEALTH CHECK
// ---------------------------------------------------------

app.get(
  "/health",
  (_req: Request, res: Response) => {

    res.json({

      success: true,

      status: "healthy",

    });

  }
);


// =========================================================
// PROTECTED TEST ROUTE
// =========================================================
//
// This route requires a valid Firebase ID token.
//
// Header:
//
// Authorization: Bearer <firebase-id-token>
//
// =========================================================

app.get(
  "/api/auth/me",
  requireAuth,
  (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    res.json({

      success: true,

      user: {

        uid:
          req.user?.uid,

        email:
          req.user?.email ?? null,

      },

    });

  }
);


// =========================================================
// 404 HANDLER
// =========================================================
//
// Any route that doesn't exist reaches here.
//
// =========================================================

app.use(
  (
    _req: Request,
    res: Response
  ) => {

    res.status(404).json({

      success: false,

      message:
        "API route not found.",

    });

  }
);


// =========================================================
// ERROR HANDLER
// =========================================================
//
// Keeps unexpected backend errors from crashing the
// application without returning a useful response.
//
// =========================================================

app.use(
  (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {

    console.error(
      "Unhandled backend error:",
      err
    );

    if (res.headersSent) {
      return;
    }

    res.status(500).json({

      success: false,

      message:
        "Internal server error.",

    });

  }
);


// =========================================================
// START SERVER
// =========================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `D-Littles backend running on port ${PORT}`
    );

    console.log(
      `Frontend URL: ${
        process.env.FRONTEND_URL ||
        "http://localhost:4200"
      }`
    );

    console.log(
      "Admission payment API: enabled"
    );

    console.log(
      "Paystack webhook support: enabled"
    );

  }
);