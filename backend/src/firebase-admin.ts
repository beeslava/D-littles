import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  getDatabase,
} from "firebase-admin/database";

import fs from "node:fs";

const databaseURL =
  process.env.FIREBASE_DATABASE_URL;

if (!databaseURL) {
  throw new Error(
    "FIREBASE_DATABASE_URL is not configured."
  );
}

function getFirebaseCredential() {
  /*
   * RENDER / PRODUCTION
   *
   * Firebase service account is supplied
   * through environment variables.
   */
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return cert({
      projectId:
        process.env.FIREBASE_PROJECT_ID,

      clientEmail:
        process.env.FIREBASE_CLIENT_EMAIL,

      privateKey:
        process.env.FIREBASE_PRIVATE_KEY.replace(
          /\\n/g,
          "\n"
        ),
    });
  }

  /*
   * LOCAL DEVELOPMENT
   *
   * Uses the downloaded Firebase service
   * account JSON file.
   */
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    "./firebase-service-account.json";

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account file not found: ${serviceAccountPath}`
    );
  }

  const serviceAccount =
    JSON.parse(
      fs.readFileSync(
        serviceAccountPath,
        "utf8"
      )
    );

  return cert(serviceAccount);
}

if (!getApps().length) {
  initializeApp({
    credential:
      getFirebaseCredential(),

    databaseURL,
  });
}

export const adminAuth = getAuth();

export const adminDatabase =
  getDatabase();