-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "initiated_by_id" TEXT;

-- CreateIndex
CREATE INDEX "Transfer_initiated_by_id_status_created_at_idx" ON "Transfer"("initiated_by_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
