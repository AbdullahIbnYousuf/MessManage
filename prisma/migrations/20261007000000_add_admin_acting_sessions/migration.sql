-- AlterEnum
ALTER TYPE "DebtNotificationEntity" ADD VALUE 'admin_action';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DebtNotificationType" ADD VALUE 'admin_access_started';
ALTER TYPE "DebtNotificationType" ADD VALUE 'admin_member_action';

-- CreateTable
CREATE TABLE "AdminActingSession" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "login_binding" TEXT NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "AdminActingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMemberAction" (
    "id" TEXT NOT NULL,
    "acting_session_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_ids" TEXT[],
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMemberAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminActingSession_token_hash_key" ON "AdminActingSession"("token_hash");

-- CreateIndex
CREATE INDEX "AdminActingSession_admin_id_login_binding_ended_at_idx" ON "AdminActingSession"("admin_id", "login_binding", "ended_at");

-- CreateIndex
CREATE INDEX "AdminActingSession_member_id_started_at_idx" ON "AdminActingSession"("member_id", "started_at");

-- CreateIndex
CREATE INDEX "AdminMemberAction_member_id_created_at_id_idx" ON "AdminMemberAction"("member_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "AdminMemberAction_admin_id_created_at_id_idx" ON "AdminMemberAction"("admin_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "AdminMemberAction_entity_ids_idx" ON "AdminMemberAction" USING GIN ("entity_ids");

-- AddForeignKey
ALTER TABLE "AdminActingSession" ADD CONSTRAINT "AdminActingSession_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActingSession" ADD CONSTRAINT "AdminActingSession_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMemberAction" ADD CONSTRAINT "AdminMemberAction_acting_session_id_fkey" FOREIGN KEY ("acting_session_id") REFERENCES "AdminActingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMemberAction" ADD CONSTRAINT "AdminMemberAction_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMemberAction" ADD CONSTRAINT "AdminMemberAction_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
