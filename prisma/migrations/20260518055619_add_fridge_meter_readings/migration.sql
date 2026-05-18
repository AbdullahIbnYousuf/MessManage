-- Add meter reading columns with defaults for existing rows, then remove defaults
-- AlterTable FridgeBill: add with defaults first so existing rows don't fail
ALTER TABLE "FridgeBill" ADD COLUMN "previous_reading" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "current_reading" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "unit_price" DECIMAL(10,4) NOT NULL DEFAULT 8;

-- Remove the defaults so future inserts must supply values explicitly
ALTER TABLE "FridgeBill" ALTER COLUMN "previous_reading" DROP DEFAULT;
ALTER TABLE "FridgeBill" ALTER COLUMN "current_reading" DROP DEFAULT;
ALTER TABLE "FridgeBill" ALTER COLUMN "unit_price" DROP DEFAULT;

-- AlterTable SystemConfig: add electricity unit price with default 8
ALTER TABLE "SystemConfig" ADD COLUMN "electricity_unit_price" DECIMAL(10,4) NOT NULL DEFAULT 8;
