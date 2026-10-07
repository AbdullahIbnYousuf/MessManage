import type { Prisma } from "@prisma/client";
import { actingOperations } from "@/lib/services/acting-context";
import { ActingError, assertActingValidity } from "@/lib/domain/acting";

type Row = Record<string, unknown>;
type Delegate = {
  findMany(args: { where?: unknown }): Promise<Row[]>;
  [method: string]: unknown;
};
type Change = { model: string; method: string; before: Row[]; after: Row[] };
const auditedModels = new Set([
  "transfer", "debtRequest", "debtObligation", "mealRecord", "mealPattern", "mealEditRequest",
  "bazarTrip", "bazarExpense", "bulkItem", "bulkCycle", "bulkAllocation", "systemConfig",
  "maidPayment", "fridgeBill", "fridgePayment", "fridgeAllocation",
]);
const writes = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);

function scalarRow(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value === null || typeof value !== "object"
    || value instanceof Date || (typeof (value as { toFixed?: unknown }).toFixed === "function")));
}

function json(value: unknown): Prisma.InputJsonValue {
  // Prisma Decimal's toJSON preserves exact monetary strings; dates are ISO timestamps.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function runAuditedTransaction<T>(tx: Prisma.TransactionClient, operation: (client: Prisma.TransactionClient) => Promise<T>): Promise<{ result: T; notificationIds: string[] }> {
  const scope = actingOperations.getStore();
  const acting = scope?.identity.acting;
  if (!scope || !acting) return { result: await operation(tx), notificationIds: [] };
  const session = await tx.adminActingSession.findUnique({ where: { id: acting.id }, include: { admin: true, member: true } });
  if (!session) throw new ActingError("ACTING_SESSION_INVALID", "Acting access is no longer valid.");
  assertActingValidity({ actorId: acting.admin.id, actorRole: session.admin.role, actorStatus: session.admin.status,
    memberStatus: session.member.status, sessionAdminId: session.adminId, sessionBinding: session.loginBinding,
    loginBinding: scope.identity.loginBinding, endedAt: session.endedAt, expiresAt: session.expiresAt });
  // Take a row lock shared with exit/revocation; the action is either completed before exit, or denied.
  await tx.$queryRaw`SELECT "id" FROM "AdminActingSession" WHERE "id" = ${acting.id} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${acting.admin.id}, ${acting.member.id}) FOR SHARE`;
  const changes: Change[] = [];
  const client = new Proxy(tx, {
    get(target, model: string) {
      if (["$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe"].includes(model)) {
        return () => { throw new ActingError("ACTING_ACTION_FORBIDDEN", "Raw changes do not support administrator attribution."); };
      }
      const delegate = Reflect.get(target, model) as unknown;
      if (!delegate || typeof delegate !== "object") return typeof delegate === "function" ? delegate.bind(target) : delegate;
      return new Proxy(delegate, {
        get(modelTarget, method: string) {
          const call = Reflect.get(modelTarget, method) as unknown;
          if (["createManyAndReturn", "updateManyAndReturn"].includes(method)) return () => {
            throw new ActingError("ACTING_ACTION_FORBIDDEN", "This write method does not support administrator attribution.");
          };
          if (!writes.has(method) || typeof call !== "function") return typeof call === "function" ? call.bind(modelTarget) : call;
          if (model === "debtNotification" && ["create", "createMany"].includes(method)) return call.bind(modelTarget);
          if (!auditedModels.has(model)) return () => { throw new ActingError("ACTING_ACTION_FORBIDDEN", "This change does not support administrator attribution."); };
          return async (args: { where?: unknown; data?: Row | Row[] }) => {
            const read = modelTarget as Delegate;
            const before = ["create", "createMany"].includes(method) ? [] : await read.findMany({ where: args.where });
            const result: unknown = await (call as (input: unknown) => Promise<unknown>).call(modelTarget, args);
            let after: Row[] = [];
            if (["create", "update", "upsert"].includes(method)) after = [scalarRow(result as Row)];
            else if (method === "updateMany") after = before.length ? await read.findMany({ where: { id: { in: before.map((row) => row.id) } } }) : [];
            else if (method === "createMany" && typeof (result as { count?: unknown }).count === "number" && (result as { count: number }).count > 0) {
              const data = Array.isArray(args.data) ? args.data : [args.data];
              // All current createMany callers provide scalar input with a unique date/user, batch, or allocation key.
              after = await read.findMany({ where: { OR: data.filter(Boolean) } });
            }
            const change = { model, method, before: before.map(scalarRow), after: after.map(scalarRow) };
            if (JSON.stringify(change.before) !== JSON.stringify(change.after)) changes.push(change);
            return result;
          };
        },
      });
    },
  }) as Prisma.TransactionClient;
  const result = await operation(client);
  if (session.expiresAt <= new Date()) throw new ActingError("ACTING_SESSION_EXPIRED", "Acting access expired. No changes were saved.", 409);
  if (!changes.length) return { result, notificationIds: [] };
  const primary = changes.find((change) => change.model === "transfer") ?? changes[0]!;
  const entityIds = Array.from(new Set([...primary.before, ...primary.after].map((row) => String(row.id))));
  const audit = await tx.adminMemberAction.create({ data: {
    actingSessionId: acting.id, adminId: acting.admin.id, memberId: acting.member.id,
    action: scope.operation, entityType: primary.model, entityIds, changes: json(changes),
  } });
  const recipients = new Set([acting.member.id]);
  for (const change of changes.filter((value) => value.model === "transfer")) {
    for (const row of [...change.before, ...change.after]) {
      if (typeof row.senderId === "string") recipients.add(row.senderId);
      if (typeof row.receiverId === "string") recipients.add(row.receiverId);
    }
  }
  const notificationIds: string[] = [];
  const money = primary.model === "transfer" ? primary.after[0] ?? primary.before[0] : null;
  for (const userId of recipients) {
    const notice = await tx.debtNotification.create({ data: {
      userId, type: "admin_member_action", entityType: money ? "transfer" : "admin_action",
      entityId: money ? String(money.id) : audit.id, title: "Administrator acted on behalf of a member",
      body: `${acting.admin.nickname || acting.admin.name} performed ${scope.operation} on behalf of ${acting.member.nickname || acting.member.name}.${money ? ` Amount: Tk ${String(money.amount)}. Status: ${String(money.status)}.` : " See your account activity for details."}`,
    }, select: { id: true } });
    notificationIds.push(notice.id);
  }
  return { result, notificationIds };
}
