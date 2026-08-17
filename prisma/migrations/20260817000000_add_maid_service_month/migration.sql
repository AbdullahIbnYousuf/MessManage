-- Additive audit fields for next-month maid accounting.
-- Existing rows remain unchanged and retain NULL as the legacy marker.

-- AlterTable
ALTER TABLE "MaidCharge" ADD COLUMN "service_month" DATE;

-- AlterTable
ALTER TABLE "MaidPayment" ADD COLUMN "service_month" DATE;
