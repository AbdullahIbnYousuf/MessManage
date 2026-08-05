import { debtErrorResponse, requireDebtUser } from "@/lib/utils/debts-api";
import { fetchDebtSummary } from "@/lib/queries/debts";

export async function GET() {
  try {
    const user = await requireDebtUser();
    return Response.json({ data: await fetchDebtSummary(user.id) });
  } catch (error) {
    return debtErrorResponse(error, "Debt summary");
  }
}
