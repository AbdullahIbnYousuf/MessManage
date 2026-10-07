import { db } from "@/lib/db";
import type { PaymentAdminAction } from "@/types/debts";

type PaymentObject = Record<string, unknown> & { id: string; type: "payment" };

export async function addPaymentAttribution(data: unknown): Promise<void> {
  const payments: PaymentObject[] = [];
  function collect(value: unknown) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    if (row.type === "payment" && typeof row.id === "string") payments.push(row as PaymentObject);
    Object.values(row).forEach(collect);
  }
  collect(data);
  if (!payments.length) return;
  const actions = await db.adminMemberAction.findMany({
    where: { entityType: "transfer", entityIds: { hasSome: [...new Set(payments.map((payment) => payment.id))] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { admin: { select: { id: true, name: true, nickname: true } }, member: { select: { id: true, name: true, nickname: true } } },
  });
  for (const payment of payments) {
    payment.onBehalfActions = actions.filter((action) => action.entityIds.includes(payment.id)).map((action): PaymentAdminAction => {
      const changes = Array.isArray(action.changes) ? action.changes : [];
      let statusAfter: string | null = null;
      for (const change of changes) {
        if (!change || typeof change !== "object" || Array.isArray(change)) continue;
        if (!Array.isArray(change.after)) continue;
        const row = change.after.find((value) => value && typeof value === "object" && !Array.isArray(value) && value.id === payment.id);
        if (row && typeof row === "object" && !Array.isArray(row) && typeof row.status === "string") statusAfter = row.status;
      }
      return { id: action.id, action: action.action, statusAfter, createdAt: action.createdAt.toISOString(),
        admin: { id: action.admin.id, name: action.admin.nickname || action.admin.name }, member: { id: action.member.id, name: action.member.nickname || action.member.name } };
    });
  }
}
