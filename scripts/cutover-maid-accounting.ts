import { writeFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "../lib/db";
import { withSerializableRetry } from "../lib/services/debts/transactions";

const SERVICE_MONTH = new Date("2026-07-01T00:00:00.000Z");
const ACCOUNTING_MONTH = new Date("2026-08-01T00:00:00.000Z");
const REQUIRED_CONFIRMATION = "2026-07-to-2026-08";

async function readState(tx: Prisma.TransactionClient) {
  const [serviceRun, accountingRun, serviceCharges, servicePayments, accountingCharges, accountingPayments] =
    await Promise.all([
      tx.monthlySettlementRun.findUnique({ where: { month: SERVICE_MONTH }, select: { id: true } }),
      tx.monthlySettlementRun.findUnique({ where: { month: ACCOUNTING_MONTH }, select: { id: true } }),
      tx.maidCharge.findMany({ where: { month: SERVICE_MONTH }, orderBy: { id: "asc" } }),
      tx.maidPayment.findMany({ where: { month: SERVICE_MONTH }, orderBy: { id: "asc" } }),
      tx.maidCharge.findMany({ where: { month: ACCOUNTING_MONTH }, orderBy: { id: "asc" } }),
      tx.maidPayment.findMany({ where: { month: ACCOUNTING_MONTH }, orderBy: { id: "asc" } }),
    ]);

  return {
    serviceRun,
    accountingRun,
    serviceCharges,
    servicePayments,
    accountingCharges,
    accountingPayments,
  };
}

type CutoverState = Awaited<ReturnType<typeof readState>>;

function sumAmounts(rows: Array<{ amount: Prisma.Decimal }>): Decimal {
  return rows.reduce((total, row) => total.add(row.amount.toString()), new Decimal(0));
}

function serializableState(state: CutoverState) {
  const serializeCharge = (row: CutoverState["serviceCharges"][number]) => ({
    id: row.id,
    userId: row.userId,
    amount: row.amount.toFixed(2),
    month: row.month.toISOString(),
    serviceMonth: row.serviceMonth?.toISOString() ?? null,
    appliedAt: row.appliedAt.toISOString(),
  });
  const serializePayment = (row: CutoverState["servicePayments"][number]) => ({
    id: row.id,
    paidById: row.paidById,
    amount: row.amount.toFixed(2),
    month: row.month.toISOString(),
    serviceMonth: row.serviceMonth?.toISOString() ?? null,
    note: row.note,
    paidAt: row.paidAt.toISOString(),
  });

  return {
    serviceMonthSettled: state.serviceRun !== null,
    accountingMonthSettled: state.accountingRun !== null,
    serviceCharges: state.serviceCharges.map(serializeCharge),
    servicePayments: state.servicePayments.map(serializePayment),
    accountingCharges: state.accountingCharges.map(serializeCharge),
    accountingPayments: state.accountingPayments.map(serializePayment),
  };
}

function assertPreconditions(state: CutoverState): void {
  if (state.serviceRun) throw new Error("Cutover aborted: July 2026 is already settled.");
  if (state.accountingRun) throw new Error("Cutover aborted: August 2026 is already settled.");
  if (state.accountingCharges.length > 0 || state.accountingPayments.length > 0) {
    throw new Error("Cutover aborted: August 2026 already contains maid records.");
  }
  if (state.serviceCharges.length === 0) {
    throw new Error("Cutover aborted: July 2026 contains no maid charges to move.");
  }
  if (
    state.serviceCharges.some((row) => row.serviceMonth !== null)
    || state.servicePayments.some((row) => row.serviceMonth !== null)
  ) {
    throw new Error("Cutover aborted: July 2026 contains records that were already reassociated.");
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const before = await withSerializableRetry(async (tx) => readState(tx));
  assertPreconditions(before);

  const chargeTotal = sumAmounts(before.serviceCharges);
  const paymentTotal = sumAmounts(before.servicePayments);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "preflight",
    from: "2026-07",
    to: "2026-08",
    chargeCount: before.serviceCharges.length,
    chargeTotal: chargeTotal.toFixed(2),
    paymentCount: before.servicePayments.length,
    paymentTotal: paymentTotal.toFixed(2),
  }, null, 2));

  if (!apply) {
    console.log("Preflight passed. No database rows were modified.");
    return;
  }
  if (process.env.CONFIRM_MAID_CUTOVER !== REQUIRED_CONFIRMATION) {
    throw new Error(`Set CONFIRM_MAID_CUTOVER=${REQUIRED_CONFIRMATION} to apply this one-time cutover.`);
  }

  const backupPath = `/tmp/messmanage-maid-cutover-${new Date().toISOString().replaceAll(":", "-")}.json`;
  await writeFile(
    backupPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), state: serializableState(before) }, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
  const expectedFingerprint = JSON.stringify(serializableState(before));

  const result = await withSerializableRetry(async (tx) => {
    const current = await readState(tx);
    assertPreconditions(current);
    if (JSON.stringify(serializableState(current)) !== expectedFingerprint) {
      throw new Error("Cutover aborted: maid records changed after the backup was created.");
    }

    const [movedCharges, movedPayments] = await Promise.all([
      tx.maidCharge.updateMany({
        where: { month: SERVICE_MONTH },
        data: { month: ACCOUNTING_MONTH, serviceMonth: SERVICE_MONTH },
      }),
      tx.maidPayment.updateMany({
        where: { month: SERVICE_MONTH },
        data: { month: ACCOUNTING_MONTH, serviceMonth: SERVICE_MONTH },
      }),
    ]);

    const after = await readState(tx);
    if (after.serviceCharges.length !== 0 || after.servicePayments.length !== 0) {
      throw new Error("Cutover verification failed: July still contains maid records.");
    }
    if (
      movedCharges.count !== before.serviceCharges.length
      || movedPayments.count !== before.servicePayments.length
      || after.accountingCharges.length !== before.serviceCharges.length
      || after.accountingPayments.length !== before.servicePayments.length
      || !sumAmounts(after.accountingCharges).eq(chargeTotal)
      || !sumAmounts(after.accountingPayments).eq(paymentTotal)
      || after.accountingCharges.some((row) => row.serviceMonth?.getTime() !== SERVICE_MONTH.getTime())
      || after.accountingPayments.some((row) => row.serviceMonth?.getTime() !== SERVICE_MONTH.getTime())
    ) {
      throw new Error("Cutover verification failed: row counts, totals, or service months differ.");
    }

    return {
      movedCharges: movedCharges.count,
      movedPayments: movedPayments.count,
      chargeTotal: sumAmounts(after.accountingCharges).toFixed(2),
      paymentTotal: sumAmounts(after.accountingPayments).toFixed(2),
    };
  });

  console.log(JSON.stringify({ status: "complete", backupPath, ...result }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
