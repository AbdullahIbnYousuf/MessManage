import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import type { UserRole } from "@/context/AuthContext";

// ─── Types ──────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

// ─── Server-Side Auth Helpers ───────────────────────────────────────
// Use these in API route handlers to verify Firebase ID tokens.

/**
 * Extract and verify the Firebase ID token from the request.
 * Expects header: `Authorization: Bearer <idToken>`
 *
 * Returns the authenticated user profile from Firestore,
 * or a 401 NextResponse if authentication fails.
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Verify the token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Fetch user profile from Firestore
    const userDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data()!;

    if (!userData.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated" },
        { status: 403 }
      );
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email ?? "",
      name: userData.name ?? "",
      role: userData.role ?? "PENDING",
      isActive: userData.isActive ?? false,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

/**
 * Same as requireAuth, but also checks that the user has ADMIN role.
 * Returns 403 if the user is authenticated but not an admin.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const result = await requireAuth(request);

  // If it's a NextResponse, it's an error — pass through
  if (result instanceof NextResponse) {
    return result;
  }

  if (result.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  return result;
}

/**
 * Same as requireAuth, but checks that the user is at least a MEMBER.
 * Rejects PENDING users with 403.
 */
export async function requireMember(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const result = await requireAuth(request);

  if (result instanceof NextResponse) {
    return result;
  }

  if (result.role === "PENDING") {
    return NextResponse.json(
      { error: "Account is pending admin approval" },
      { status: 403 }
    );
  }

  return result;
}
