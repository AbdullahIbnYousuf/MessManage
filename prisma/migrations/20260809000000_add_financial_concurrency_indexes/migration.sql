-- Additive safety migration. This migration never updates or deletes rows.
-- Fail with a descriptive error if live data violates either new invariant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BazarExpense"
    GROUP BY "trip_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add BazarExpense trip uniqueness: duplicate trip_id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "BulkCycle"
    WHERE "status" = 'active'
    GROUP BY "bulk_item_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add active BulkCycle uniqueness: an item has multiple active cycles';
  END IF;
END $$;

CREATE UNIQUE INDEX "BazarExpense_trip_id_key"
ON "BazarExpense"("trip_id");

CREATE UNIQUE INDEX "unique_active_bulk_cycle_per_item"
ON "BulkCycle"("bulk_item_id")
WHERE "status" = 'active';
