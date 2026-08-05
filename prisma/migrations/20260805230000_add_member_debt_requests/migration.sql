-- CreateEnum
CREATE TYPE "DebtRequestStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- AlterEnum
ALTER TYPE "DebtObligationSource" ADD VALUE 'member_request';

-- AlterEnum
ALTER TYPE "DebtNotificationEntity" ADD VALUE 'debt_request';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DebtNotificationType" ADD VALUE 'debt_request_received';
ALTER TYPE "DebtNotificationType" ADD VALUE 'debt_request_accepted';
ALTER TYPE "DebtNotificationType" ADD VALUE 'debt_request_rejected';
ALTER TYPE "DebtNotificationType" ADD VALUE 'debt_request_cancelled';

-- AlterTable
ALTER TABLE "DebtObligation" ADD COLUMN     "debt_request_id" TEXT,
ALTER COLUMN "monthly_settlement_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DebtRequest" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "debtor_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DebtRequestStatus" NOT NULL DEFAULT 'pending',
    "client_request_id" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "DebtRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebtRequest_client_request_id_key" ON "DebtRequest"("client_request_id");

-- CreateIndex
CREATE INDEX "DebtRequest_requester_id_status_created_at_idx" ON "DebtRequest"("requester_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "DebtRequest_debtor_id_status_created_at_idx" ON "DebtRequest"("debtor_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "DebtRequest_status_created_at_idx" ON "DebtRequest"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "DebtObligation_debt_request_id_key" ON "DebtObligation"("debt_request_id");

-- AddForeignKey
ALTER TABLE "DebtObligation" ADD CONSTRAINT "DebtObligation_debt_request_id_fkey" FOREIGN KEY ("debt_request_id") REFERENCES "DebtRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtRequest" ADD CONSTRAINT "DebtRequest_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtRequest" ADD CONSTRAINT "DebtRequest_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
