import { db } from "../lib/db";

type DuplicateBazarTrip = { tripId: string; recordCount: bigint };
type DuplicateActiveBulkCycle = { bulkItemId: string; recordCount: bigint };

async function main(): Promise<void> {
  const [duplicateBazarTrips, duplicateActiveBulkCycles] = await Promise.all([
    db.$queryRaw<DuplicateBazarTrip[]>`
      SELECT "trip_id" AS "tripId", COUNT(*) AS "recordCount"
      FROM "BazarExpense"
      GROUP BY "trip_id"
      HAVING COUNT(*) > 1
      ORDER BY "trip_id"
    `,
    db.$queryRaw<DuplicateActiveBulkCycle[]>`
      SELECT "bulk_item_id" AS "bulkItemId", COUNT(*) AS "recordCount"
      FROM "BulkCycle"
      WHERE "status" = 'active'
      GROUP BY "bulk_item_id"
      HAVING COUNT(*) > 1
      ORDER BY "bulk_item_id"
    `,
  ]);

  if (duplicateBazarTrips.length > 0 || duplicateActiveBulkCycles.length > 0) {
    console.error("Financial concurrency-index preflight failed.");
    console.error({ duplicateBazarTrips, duplicateActiveBulkCycles });
    process.exitCode = 1;
    return;
  }

  console.log("Financial concurrency-index preflight passed; no duplicate rows found.");
}

main()
  .catch((error: unknown) => {
    console.error("Financial concurrency-index preflight could not complete.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
