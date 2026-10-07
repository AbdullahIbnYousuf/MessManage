import { randomBytes } from "node:crypto";
import type { IdentityContext } from "@/types/acting";
import { db } from "@/lib/db";
import { ActingError, ACTING_DURATION_MS, validateActingReason } from "@/lib/domain/acting";
import { hashActingToken } from "@/lib/services/acting-identity";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { deliverDebtNotifications } from "@/lib/services/debts/notifications";

export async function startActing(context: IdentityContext, memberId: unknown, reasonInput: unknown) {
  if (!context.actor || context.actor.role !== "admin" || context.actor.status !== "active") throw new ActingError("ACTING_FORBIDDEN", "Only an active administrator can act as a member.");
  if (context.cookiePresent) throw new ActingError("ACTING_ALREADY_ACTIVE", "Return to your account before selecting another member.", 409);
  if (!context.loginBinding) throw new ActingError("ACTING_LOGIN_REQUIRED", "Sign out and sign in again before using Act as member.", 409);
  if (typeof memberId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(memberId)) throw new ActingError("ACTING_MEMBER_INVALID", "Select a valid member.", 400);
  if (memberId === context.actor.id) throw new ActingError("ACTING_SELF_FORBIDDEN", "You are already using your own account.", 400);
  const reason = validateActingReason(reasonInput);
  const token = randomBytes(32).toString("hex");
  const actor = context.actor;
  const binding = context.loginBinding;
  const result = await withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actor.id}, ${memberId}) FOR UPDATE`;
    const [admin, member, existing] = await Promise.all([
      tx.user.findUnique({ where: { id: actor.id } }), tx.user.findUnique({ where: { id: memberId } }),
      tx.adminActingSession.findFirst({ where: { adminId: actor.id, loginBinding: binding, endedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    if (!admin || admin.role !== "admin" || admin.status !== "active") throw new ActingError("ACTING_FORBIDDEN", "Administrator access is no longer available.");
    if (!member || member.status !== "active") throw new ActingError("ACTING_MEMBER_INACTIVE", "Select an active member.");
    if (existing) throw new ActingError("ACTING_ALREADY_ACTIVE", "An acting session is already active for this login.", 409);
    const session = await tx.adminActingSession.create({ data: {
      adminId: actor.id, memberId, tokenHash: hashActingToken(token), loginBinding: binding,
      reason, expiresAt: new Date(Date.now() + ACTING_DURATION_MS),
    } });
    const audit = await tx.adminMemberAction.create({ data: {
      actingSessionId: session.id, adminId: actor.id, memberId, action: "session.started",
      entityType: "account", entityIds: [memberId], changes: { startedAt: session.startedAt.toISOString() },
    } });
    const notice = await tx.debtNotification.create({ data: {
      userId: memberId, type: "admin_access_started", entityType: "admin_action", entityId: audit.id,
      title: "Administrator access to your account", body: `${admin.nickname || admin.name} started acting on your behalf. View Actions on your behalf in Profile for details.`,
    } });
    const participant = (user: typeof admin) => ({ id: user.id, name: user.name, nickname: user.nickname });
    return { id: session.id, expiresAt: session.expiresAt.toISOString(), notificationId: notice.id,
      admin: participant(admin), member: participant(member) };
  });
  try { await deliverDebtNotifications([result.notificationId]); } catch (error) { console.error("Acting access push failed", error); }
  return { token, id: result.id, expiresAt: result.expiresAt, admin: result.admin, member: result.member };
}

export async function endActing(context: IdentityContext, token: string | undefined) {
  if (!context.actor || !token) return;
  await withSerializableRetry(async (tx) => {
    const session = await tx.adminActingSession.findUnique({ where: { tokenHash: hashActingToken(token) } });
    if (!session || session.adminId !== context.actor!.id || session.loginBinding !== context.loginBinding || session.endedAt) return;
    const changed = await tx.adminActingSession.updateMany({ where: { id: session.id, endedAt: null }, data: { endedAt: new Date() } });
    if (changed.count) await tx.adminMemberAction.create({ data: {
      actingSessionId: session.id, adminId: session.adminId, memberId: session.memberId,
      action: "session.ended", entityType: "account", entityIds: [session.memberId], changes: { endedAt: new Date().toISOString() },
    } });
  });
}

export async function actingActionHistory(memberId: string | undefined, cursor: string | null, limit = 25) {
  if (cursor && !/^[0-9a-f-]{36}$/i.test(cursor)) throw new ActingError("VALIDATION_ERROR", "Invalid activity cursor.", 400);
  const cursorRow = cursor ? await db.adminMemberAction.findFirst({ where: { id: cursor, ...(memberId ? { memberId } : {}) } }) : null;
  if (cursor && !cursorRow) throw new ActingError("VALIDATION_ERROR", "Invalid activity cursor.", 400);
  const rows = await db.adminMemberAction.findMany({
    where: { ...(memberId ? { memberId } : {}), ...(cursorRow ? { OR: [{ createdAt: { lt: cursorRow.createdAt } }, { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    include: { admin: { select: { id: true, name: true, nickname: true } }, member: { select: { id: true, name: true, nickname: true } }, actingSession: { select: { reason: true } } },
  });
  const page = rows.slice(0, limit);
  return { actions: page.map((row) => ({ id: row.id, action: row.action, entityType: row.entityType, entityIds: row.entityIds,
    changes: row.changes, createdAt: row.createdAt.toISOString(), reason: row.actingSession.reason,
    admin: { id: row.admin.id, name: row.admin.nickname || row.admin.name }, member: { id: row.member.id, name: row.member.nickname || row.member.name } })),
    nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null };
}
