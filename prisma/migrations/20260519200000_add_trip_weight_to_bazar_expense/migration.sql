-- Add trip_weight column to BazarExpense
-- This represents the net effect of the two previously applied migrations:
--   20260519183538_add_bazar_trip_type (added trip_type enum column)
--   20260519190000_replace_trip_type_with_trip_weight (replaced with trip_weight, dropped enum)
-- The column already exists in the database. This file is for history tracking only.
ALTER TABLE "BazarExpense"
ADD COLUMN "trip_weight" DECIMAL(3, 2) NOT NULL DEFAULT 1.0;
