-- AlterEnum
ALTER TYPE "MealEditRequestStatus" ADD VALUE 'invalidated';

-- AlterTable
ALTER TABLE "MealEditRequest" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "original_meal_count" INTEGER,
ADD COLUMN     "proposed_meal_count" INTEGER,
ADD COLUMN     "target_date" DATE,
ALTER COLUMN "meal_record_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MealEditRequest_batch_id_idx" ON "MealEditRequest"("batch_id");

-- CreateIndex
CREATE INDEX "MealEditRequest_user_id_target_date_status_idx" ON "MealEditRequest"("user_id", "target_date", "status");
