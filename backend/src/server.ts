import "dotenv/config";

import "./firebase-admin.js";

import express from "express";
import cors from "cors";

import {
  requireAuth,
  AuthenticatedRequest
} from "./auth-middleware.js";

import admissionRoutes from "./admission-routes.js";


const app = express();


const PORT =
  Number(process.env.PORT) || 10000;


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());


// =========================================================
// ADMISSION ROUTES
// =========================================================
//
// POST /api/admissions/approve
//
// Requires:
// Authorization: Bearer <firebase-id-token>
//
// =========================================================

app.use(
  "/api/admissions",
  admissionRoutes
);


// =========================================================
// PUBLIC ROUTES
// =========================================================

app.get("/", (_req, res) => {

  res.json({
    success: true,

    message:
      "D-Littles backend is running.",
  });

});


app.get("/health", (_req, res) => {

  res.json({
    success: true,

    status: "healthy",
  });

});


// =========================================================
// PROTECTED TEST ROUTE
// =========================================================
//
// This route requires a valid Firebase ID token.
//
// The token must be sent as:
//
// Authorization: Bearer <firebase-id-token>
//
// =========================================================

app.get(
  "/api/auth/me",
  requireAuth,
  (req: AuthenticatedRequest, res) => {

    res.json({

      success: true,

      user: {
        uid: req.user?.uid,
        email: req.user?.email ?? null,
      },

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

  }
);