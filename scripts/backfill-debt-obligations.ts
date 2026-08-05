import { loadEnvConfig } from "@next/env";
import Decimal from "decimal.js";
import { db } from "../lib/db";

loadEnvConfig(process.cwd());

const BATCH_SIZE = 100;

type BackfillSummary = {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
  runsCreated: number;
  runsSkipped: number;
  settlementsLinked: number;
};

const summary: BackfillSummary = {
  scanned: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  runsCreated: 0,
  runsSkipped: 0,
  settlementsLinked: 0,
};

function assertValidSettlement(settlement: {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: Decimal;
}): void {
  if (settlement.fromUserId === settlement.toUserId) {
    throw new Error(`Settlement ${settlement.id} has identical debtor and creditor.`);
  }
  if (settlement.amount.lte(0)) {
    throw new Error(`Settlement ${settlement.id} has a non-positive amount.`);
  }
}

async function backfill(): Promise<void> {
  const monthGroups = await db.monthlySettlement.groupBy({
    by: ["month"],
    _min: { settledAt: true },
    orderBy: { month: "asc" },
  });

  for (const group of monthGroups) {
    const settledAt = group._min.settledAt;
    if (!settledAt) {
      throw new Error(`Settlement month ${group.month.toISOString()} has no settlement timestamp.`);
    }

    const existingRun = await db.monthlySettlementRun.findUnique({
      where: { month: group.month },
    });
    const run = await db.monthlySettlementRun.upsert({
      where: { month: group.month },
      update: {},
      create: {
        month: group.month,
        trigger: "backfill",
        settledById: null,
        settledAt,
      },
    });

    if (existingRun) summary.runsSkipped += 1;
    else summary.runsCreated += 1;

    let afterId: string | undefined;
    while (true) {
      const settlements = await db.monthlySettlement.findMany({
        where: {
          month: group.month,
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        include: { obligation: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      });

      if (settlements.length === 0) break;

      for (const settlement of settlements) {
        assertValidSettlement({
          ...settlement,
          amount: new Decimal(settlement.amount.toString()),
        });

        if (settlement.runId && settlement.runId !== run.id) {
          throw new Error(`Settlement ${settlement.id} is linked to the wrong settlement run.`);
        }

        const expectedSourceReference = `meal-settlement:${settlement.id}`;
        if (settlement.obligation) {
          const obligation = settlement.obligation;
          const matchesSource =
            obligation.debtorId === settlement.fromUserId
            && obligation.creditorId === settlement.toUserId
            && new Decimal(obligation.amount.toString()).eq(settlement.amount.toString())
            && obligation.source === "meal_settlement"
            && obligation.sourceReference === expectedSourceReference
            && obligation.createdAt.getTime() === settlement.settledAt.getTime();

          if (!matchesSource) {
            throw new Error(`Existing obligation for settlement ${settlement.id} does not match its source.`);
          }
        }
      }

      await db.$transaction(async (tx) => {
        for (const settlement of settlements) {
          if (!settlement.runId) {
            await tx.monthlySettlement.update({
              where: { id: settlement.id },
              data: { runId: run.id },
            });
          }

          if (!settlement.obligation) {
            await tx.debtObligation.create({
              data: {
                debtorId: settlement.fromUserId,
                creditorId: settlement.toUserId,
                amount: settlement.amount,
                source: "meal_settlement",
                sourceReference: `meal-settlement:${settlement.id}`,
                monthlySettlementId: settlement.id,
                createdAt: settlement.settledAt,
              },
            });
          }
        }
      }, { maxWait: 20_000, timeout: 60_000 });

      summary.scanned += settlements.length;
      summary.settlementsLinked += settlements.filter((settlement) => !settlement.runId).length;
      summary.created += settlements.filter((settlement) => !settlement.obligation).length;
      summary.skipped += settlements.filter((settlement) => settlement.obligation !== null).length;
      afterId = settlements.at(-1)?.id;
    }
  }

  const historicalMonths = monthGroups.map((group) => group.month);
  const [settlementCount, obligationCount, runCount, missingRunCount, missingObligationCount] =
    await Promise.all([
      db.monthlySettlement.count(),
      db.debtObligation.count({ where: { source: "meal_settlement" } }),
      db.monthlySettlementRun.count({ where: { month: { in: historicalMonths } } }),
      db.monthlySettlement.count({ where: { runId: null } }),
      db.monthlySettlement.count({ where: { obligation: null } }),
    ]);

  if (
    settlementCount !== obligationCount
    || runCount !== monthGroups.length
    || missingRunCount !== 0
    || missingObligationCount !== 0
  ) {
    throw new Error(
      `Reconciliation failed: settlements=${settlementCount} obligations=${obligationCount} `
      + `runs=${runCount} months=${monthGroups.length} missingRuns=${missingRunCount} `
      + `missingObligations=${missingObligationCount}.`
    );
  }

  console.log(
    `DebtSync backfill complete: scanned=${summary.scanned} created=${summary.created} `
    + `skipped=${summary.skipped} failed=0 runsCreated=${summary.runsCreated} `
    + `runsSkipped=${summary.runsSkipped} settlementsLinked=${summary.settlementsLinked}`
  );
  console.log(JSON.stringify(summary));
}

backfill()
  .catch((error: unknown) => {
    summary.failed += 1;
    console.error("DebtSync backfill failed:", error instanceof Error ? error.message : "Unknown error");
    console.log(JSON.stringify(summary));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
