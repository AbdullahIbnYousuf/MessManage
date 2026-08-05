-- CreateEnum
CREATE TYPE "DebtObligationSource" AS ENUM ('meal_settlement');

-- CreateEnum
CREATE TYPE "SettlementTrigger" AS ENUM ('manual', 'cron', 'backfill');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "TransferSource" AS ENUM ('direct', 'reversal');

-- CreateEnum
CREATE TYPE "DebtNotificationEntity" AS ENUM ('obligation', 'transfer');

-- CreateEnum
CREATE TYPE "DebtNotificationType" AS ENUM ('obligation_created', 'payment_received', 'payment_accepted', 'payment_rejected', 'payment_cancelled', 'reversal_received', 'reversal_accepted', 'reversal_rejected', 'reversal_cancelled');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "MonthlySettlement" ADD COLUMN     "run_id" TEXT;

-- CreateTable
CREATE TABLE "MonthlySettlementRun" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "trigger" "SettlementTrigger" NOT NULL,
    "settled_by" TEXT,
    "settled_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySettlementRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtObligation" (
    "id" TEXT NOT NULL,
    "debtor_id" TEXT NOT NULL,
    "creditor_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" "DebtObligationSource" NOT NULL,
    "source_reference" TEXT NOT NULL,
    "monthly_settlement_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "source" "TransferSource" NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "reverses_transfer_id" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtNotification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "DebtNotificationType" NOT NULL,
    "entity_type" "DebtNotificationEntity" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "push_status" "PushDeliveryStatus" NOT NULL DEFAULT 'pending',
    "push_attempted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtNotification_pkey" PRIMARY KEY ("id")
);

-- Financial integrity checks not expressible in the Prisma schema.
ALTER TABLE "DebtObligation"
ADD CONSTRAINT "DebtObligation_amount_positive" CHECK ("amount" > 0),
ADD CONSTRAINT "DebtObligation_distinct_parties" CHECK ("debtor_id" <> "creditor_id");

ALTER TABLE "Transfer"
ADD CONSTRAINT "Transfer_amount_positive" CHECK ("amount" > 0),
ADD CONSTRAINT "Transfer_distinct_parties" CHECK ("sender_id" <> "receiver_id"),
ADD CONSTRAINT "Transfer_rejection_reason_matches_status" CHECK (
    ("status" = 'rejected' AND "rejection_reason" IS NOT NULL)
    OR
    ("status" <> 'rejected' AND "rejection_reason" IS NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySettlementRun_month_key" ON "MonthlySettlementRun"("month");

-- CreateIndex
CREATE INDEX "MonthlySettlementRun_settled_at_idx" ON "MonthlySettlementRun"("settled_at");

-- CreateIndex
CREATE UNIQUE INDEX "DebtObligation_source_reference_key" ON "DebtObligation"("source_reference");

-- CreateIndex
CREATE UNIQUE INDEX "DebtObligation_monthly_settlement_id_key" ON "DebtObligation"("monthly_settlement_id");

-- CreateIndex
CREATE INDEX "DebtObligation_debtor_id_created_at_idx" ON "DebtObligation"("debtor_id", "created_at");

-- CreateIndex
CREATE INDEX "DebtObligation_creditor_id_created_at_idx" ON "DebtObligation"("creditor_id", "created_at");

-- CreateIndex
CREATE INDEX "DebtObligation_source_created_at_idx" ON "DebtObligation"("source", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_client_request_id_key" ON "Transfer"("client_request_id");

-- CreateIndex
CREATE INDEX "Transfer_sender_id_status_created_at_idx" ON "Transfer"("sender_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "Transfer_receiver_id_status_created_at_idx" ON "Transfer"("receiver_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "Transfer_status_created_at_idx" ON "Transfer"("status", "created_at");

-- CreateIndex
CREATE INDEX "Transfer_reverses_transfer_id_idx" ON "Transfer"("reverses_transfer_id");

-- Only one live reversal attempt may exist for an original transfer.
CREATE UNIQUE INDEX "unique_active_reversal_per_transfer"
ON "Transfer" ("reverses_transfer_id")
WHERE "reverses_transfer_id" IS NOT NULL
  AND "status" IN ('pending', 'accepted');

-- CreateIndex
CREATE INDEX "DebtNotification_user_id_read_at_created_at_idx" ON "DebtNotification"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "DebtNotification_user_id_created_at_idx" ON "DebtNotification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "DebtNotification_entity_type_entity_id_idx" ON "DebtNotification"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "MonthlySettlement_run_id_idx" ON "MonthlySettlement"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySettlement_month_from_user_id_to_user_id_key" ON "MonthlySettlement"("month", "from_user_id", "to_user_id");

-- AddForeignKey
ALTER TABLE "MonthlySettlement" ADD CONSTRAINT "MonthlySettlement_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "MonthlySettlementRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySettlementRun" ADD CONSTRAINT "MonthlySettlementRun_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtObligation" ADD CONSTRAINT "DebtObligation_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtObligation" ADD CONSTRAINT "DebtObligation_creditor_id_fkey" FOREIGN KEY ("creditor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtObligation" ADD CONSTRAINT "DebtObligation_monthly_settlement_id_fkey" FOREIGN KEY ("monthly_settlement_id") REFERENCES "MonthlySettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_reverses_transfer_id_fkey" FOREIGN KEY ("reverses_transfer_id") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtNotification" ADD CONSTRAINT "DebtNotification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
