import "dotenv/config";

import "./firebase-admin.js";

import express from "express";
import cors from "cors";

const app = express();

const PORT =
  Number(process.env.PORT) || 10000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

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

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `D-Littles backend running on port ${PORT}`
    );
  }
);