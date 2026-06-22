BEGIN;

-- This migration intentionally has no backfill because production had no
-- FridgeBill rows when the feature was prepared. Fail closed if that changes:
-- dropping per_member_amount without exact historical recipients is unsafe.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "FridgeBill" LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot add frozen fridge allocations while FridgeBill contains data. Backfill exact recipients before retrying.';
    END IF;
END $$;

-- CreateTable
CREATE TABLE "FridgeAllocation" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FridgeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FridgeAllocation_bill_id_user_id_key" ON "FridgeAllocation"("bill_id", "user_id");

-- AddForeignKey
ALTER TABLE "FridgeAllocation" ADD CONSTRAINT "FridgeAllocation_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "FridgeBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgeAllocation" ADD CONSTRAINT "FridgeAllocation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove the unsafe global share only after the replacement table is ready.
ALTER TABLE "FridgeBill" DROP COLUMN "per_member_amount";

COMMIT;
