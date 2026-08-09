import type { Prisma } from "@prisma/client";
import { FinancialError } from "@/lib/domain/financial-errors";

type MonthStateClient = Pick<Prisma.TransactionClient, "monthlySettlementRun">;

export async function assertMonthOpen(
  client: MonthStateClient,
  month: Date
): Promise<void> {
  const settlement = await client.monthlySettlementRun.findUnique({
    where: { month },
    select: { id: true },
  });

  if (settlement) {
    throw new FinancialError(
      "MONTH_SETTLED",
      "This month has already been settled and is read-only."
    );
  }
}
