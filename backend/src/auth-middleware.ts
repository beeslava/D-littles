import type {Request, Response, NextFunction} from "express";
import {adminAuth} from "./firebase-admin.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
      return;
    }

    if (!authorization.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
      return;
    }

    const idToken =
      authorization.substring(7).trim();

    if (!idToken) {
      res.status(401).json({
        success: false,
        message: "Firebase ID token is missing.",
      });
      return;
    }

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token.",
    });
  }
}

