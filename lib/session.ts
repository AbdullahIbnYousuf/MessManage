// Session helpers — type-safe user extraction for API routes and Server Components.

import { auth } from "@/lib/auth";
import type { SessionUser } from "@/types";

/**
 * Returns the authenticated SessionUser or null.
 * Use this in Server Components and API routes.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    nickname: session.user.nickname ?? null,
    avatarUrl: session.user.avatarUrl ?? null,
    role: (session.user.role as SessionUser["role"]) ?? "member",
    status: (session.user.status as SessionUser["status"]) ?? "active",
  };
}

/**
 * Returns the session user and throws a Response if not authenticated.
 * Use this at the top of every API route handler.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (user.status === "deactivated") {
    throw Response.json({ error: "Account deactivated" }, { status: 403 });
  }
  return user;
}

/**
 * Same as requireAuth but also checks for admin role.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}
