import { withPaymentAttribution } from "@/lib/utils/payment-attribution-route";
import { debtErrorResponse, requireDebtUser } from "@/lib/utils/debts-api";
import { fetchDebtSummary } from "@/lib/queries/debts";

async function getAttributionHandler() {
  try {
    const user = await requireDebtUser();
    return Response.json({ data: await fetchDebtSummary(user.id) });
  } catch (error) {
    return debtErrorResponse(error, "Debt summary");
  }
}

export const GET = withPaymentAttribution(getAttributionHandler);
