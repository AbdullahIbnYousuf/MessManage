import {
  initializeApp,
  getApps,
  cert,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ─── Firebase Admin SDK ─────────────────────────────────────────────
// Used ONLY in server-side code (API routes, server components).
// Requires the FIREBASE_SERVICE_ACCOUNT_KEY env var to be set.

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set in environment variables. " +
        "Download it from Firebase Console → Project Settings → Service Accounts."
    );
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountKey) as ServiceAccount;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. " +
        "Paste the entire service account JSON file content as a single line."
    );
  }

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

const adminApp = getAdminApp();

// ─── Exports ────────────────────────────────────────────────────────
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export default adminApp;
