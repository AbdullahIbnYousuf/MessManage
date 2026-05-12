-- CreateTable
CREATE TABLE "FridgeBill" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "per_member_amount" DECIMAL(12,2) NOT NULL,
    "member_count" INTEGER NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "posted_by" TEXT NOT NULL,

    CONSTRAINT "FridgeBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FridgePayment" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "paid_by" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FridgePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FridgeBill_month_key" ON "FridgeBill"("month");

-- AddForeignKey
ALTER TABLE "FridgePayment" ADD CONSTRAINT "FridgePayment_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "FridgeBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgePayment" ADD CONSTRAINT "FridgePayment_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
