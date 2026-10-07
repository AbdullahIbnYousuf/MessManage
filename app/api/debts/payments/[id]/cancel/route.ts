import { withMemberRoute } from "@/lib/utils/acting-route";
import {
  debtErrorResponse,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { cancelPayment } from "@/lib/services/debts/payments";

async function postHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const { id } = await params;
    const result = await cancelPayment(user.id, id);
    return Response.json({ data: result.payment });
  } catch (error) {
    return debtErrorResponse(error, "Payment cancellation");
  }
}

export const POST = withMemberRoute("payment.cancel", postHandler);
