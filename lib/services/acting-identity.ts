import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionUser } from "@/types";
import type { IdentityContext } from "@/types/acting";
import { ACTING_COOKIE, ACTING_CONTEXT_HEADER, ActingError, assertActingValidity, assertExpectedContext } from "@/lib/domain/acting";
import { actingOperations } from "@/lib/services/acting-context";

export const hashActingToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const getIdentityContext = cache(async (): Promise<IdentityContext> => {
  const authSession = await auth();
  const actor = authSession?.user?.id ? {
    id: authSession.user.id, email: authSession.user.email ?? "", name: authSession.user.name ?? "",
    nickname: authSession.user.nickname ?? null, avatarUrl: authSession.user.avatarUrl ?? null,
    role: authSession.user.role as SessionUser["role"], status: authSession.user.status as SessionUser["status"],
  } : null;
  const token = (await cookies()).get(ACTING_COOKIE)?.value;
  const context: IdentityContext = { actor, effective: actor, loginBinding: authSession?.user.loginBinding ?? null,
    acting: null, cookiePresent: Boolean(token), error: null };
  if (!token) return context;
  try {
    if (!actor || !/^[a-f0-9]{64}$/.test(token)) throw new ActingError("ACTING_SESSION_INVALID", "Return to your account before continuing.");
    const acting = await db.adminActingSession.findUnique({
      where: { tokenHash: hashActingToken(token) }, include: { admin: true, member: true },
    });
    if (!acting) throw new ActingError("ACTING_SESSION_INVALID", "Acting access is no longer valid.");
    assertActingValidity({ actorId: actor.id, actorRole: acting.admin.role, actorStatus: acting.admin.status,
      memberStatus: acting.member.status, sessionAdminId: acting.adminId, sessionBinding: acting.loginBinding,
      loginBinding: context.loginBinding, endedAt: acting.endedAt, expiresAt: acting.expiresAt });
    const member: SessionUser = { id: acting.member.id, email: acting.member.email, name: acting.member.name,
      nickname: acting.member.nickname, avatarUrl: acting.member.avatarUrl, status: acting.member.status, role: "member" };
    context.effective = member;
    context.acting = { id: acting.id, admin: { ...actor, role: "admin" }, member, expiresAt: acting.expiresAt.toISOString() };
  } catch (error) {
    context.effective = null;
    context.error = error instanceof ActingError ? { code: error.code, message: error.message }
      : { code: "ACTING_SESSION_UNAVAILABLE", message: "Could not verify acting access. Return to your account or retry." };
  }
  return context;
});

export async function assertIdentityRequest(context: IdentityContext): Promise<void> {
  if (context.error) throw Response.json({ error: context.error.message, code: context.error.code }, { status: 409 });
  const requestHeaders = await headers();
  try {
    assertExpectedContext(requestHeaders.get(ACTING_CONTEXT_HEADER), context.acting?.id ?? "self");
    const method = requestHeaders.get("x-mm-method");
    if (context.acting && method && !["GET", "HEAD", "OPTIONS"].includes(method) && !actingOperations.getStore()) {
      throw new ActingError("ACTING_ACTION_FORBIDDEN", "This action is unavailable while acting as a member.");
    }
  } catch (error) {
    if (error instanceof ActingError) throw Response.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

export async function requirePersonalAccount(): Promise<void> {
  const context = await getIdentityContext();
  if (context.cookiePresent) throw Response.json({ error: "Return to your own account to perform this action.", code: "ACTING_ACTION_FORBIDDEN" }, { status: 403 });
}
