-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('member', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deactivated');

-- CreateEnum
CREATE TYPE "MembershipRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "BazarTripStatus" AS ENUM ('open', 'completed');

-- CreateEnum
CREATE TYPE "BulkCycleStatus" AS ENUM ('active', 'finished');

-- CreateEnum
CREATE TYPE "MealEditRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL,
    "deactivated_at" TIMESTAMP(3),
    "phone_number" TEXT,
    "phone_number_2" TEXT,
    "bkash_number" TEXT,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relation" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" "MembershipRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "user_id" TEXT,

    CONSTRAINT "MembershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPattern" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monday" INTEGER NOT NULL DEFAULT 0,
    "tuesday" INTEGER NOT NULL DEFAULT 0,
    "wednesday" INTEGER NOT NULL DEFAULT 0,
    "thursday" INTEGER NOT NULL DEFAULT 0,
    "friday" INTEGER NOT NULL DEFAULT 0,
    "saturday" INTEGER NOT NULL DEFAULT 0,
    "sunday" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealRecord" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal_count" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MealRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEditRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meal_record_id" TEXT NOT NULL,
    "status" "MealEditRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "MealEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazarTrip" (
    "id" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "assignee_1" TEXT,
    "assignee_2" TEXT,
    "shopping_notes" TEXT,
    "status" "BazarTripStatus" NOT NULL DEFAULT 'open',
    "triggered_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "BazarTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazarExpense" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "date" DATE NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BazarExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkCycle" (
    "id" TEXT NOT NULL,
    "bulk_item_id" TEXT NOT NULL,
    "purchased_by" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "status" "BulkCycleStatus" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "finished_by" TEXT,

    CONSTRAINT "BulkCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkAllocation" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meals_during_cycle" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaidCharge" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" DATE NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaidCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaidPayment" (
    "id" TEXT NOT NULL,
    "paid_by" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" DATE NOT NULL,
    "note" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaidPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySettlement" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "meal_deadline" TEXT NOT NULL,
    "maid_charge_default" DECIMAL(12,2) NOT NULL,
    "active_trip_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRequest_user_id_key" ON "MembershipRequest"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "MealPattern_user_id_key" ON "MealPattern"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "MealRecord_user_id_date_key" ON "MealRecord"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BulkItem_name_key" ON "BulkItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BulkAllocation_user_id_cycle_id_key" ON "BulkAllocation"("user_id", "cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "MaidCharge_user_id_month_key" ON "MaidCharge"("user_id", "month");

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPattern" ADD CONSTRAINT "MealPattern_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealRecord" ADD CONSTRAINT "MealRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEditRequest" ADD CONSTRAINT "MealEditRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEditRequest" ADD CONSTRAINT "MealEditRequest_meal_record_id_fkey" FOREIGN KEY ("meal_record_id") REFERENCES "MealRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEditRequest" ADD CONSTRAINT "MealEditRequest_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarTrip" ADD CONSTRAINT "BazarTrip_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarTrip" ADD CONSTRAINT "BazarTrip_assignee_1_fkey" FOREIGN KEY ("assignee_1") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarTrip" ADD CONSTRAINT "BazarTrip_assignee_2_fkey" FOREIGN KEY ("assignee_2") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarExpense" ADD CONSTRAINT "BazarExpense_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarExpense" ADD CONSTRAINT "BazarExpense_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "BazarTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkCycle" ADD CONSTRAINT "BulkCycle_bulk_item_id_fkey" FOREIGN KEY ("bulk_item_id") REFERENCES "BulkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkCycle" ADD CONSTRAINT "BulkCycle_purchased_by_fkey" FOREIGN KEY ("purchased_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkCycle" ADD CONSTRAINT "BulkCycle_finished_by_fkey" FOREIGN KEY ("finished_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkAllocation" ADD CONSTRAINT "BulkAllocation_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "BulkCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkAllocation" ADD CONSTRAINT "BulkAllocation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaidCharge" ADD CONSTRAINT "MaidCharge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaidPayment" ADD CONSTRAINT "MaidPayment_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySettlement" ADD CONSTRAINT "MonthlySettlement_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySettlement" ADD CONSTRAINT "MonthlySettlement_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_active_trip_id_fkey" FOREIGN KEY ("active_trip_id") REFERENCES "BazarTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SystemConfig seed
INSERT INTO "SystemConfig" ("id", "meal_deadline", "maid_charge_default", "updated_at")
VALUES (gen_random_uuid(), '22:00', 700, NOW())
ON CONFLICT DO NOTHING;

-- Partial Unique Index for BazarTrip
CREATE UNIQUE INDEX "unique_open_bazar_trip"
ON "BazarTrip" ("status")
WHERE "status" = 'open';
