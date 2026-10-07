// Session helpers — type-safe user extraction for API routes and Server Components.

import { getIdentityContext, assertIdentityRequest } from "@/lib/services/acting-identity";
import type { SessionUser } from "@/types";
import { actingOperations } from "@/lib/services/acting-context";

/**
 * Returns the authenticated SessionUser or null.
 * Use this in Server Components and API routes.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const context = actingOperations.getStore()?.identity ?? await getIdentityContext();
  if (context.error) return null;
  await assertIdentityRequest(context);
  return context.effective;
}

/**
 * Returns the session user and throws a Response if not authenticated.
 * Use this at the top of every API route handler.
 */
export async function requireAuth(): Promise<SessionUser> {
  const context = actingOperations.getStore()?.identity ?? await getIdentityContext();
  await assertIdentityRequest(context);
  const user = context.effective;
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
