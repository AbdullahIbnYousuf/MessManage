import {
  debtErrorResponse,
  readJsonObject,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { respondToPayment } from "@/lib/services/debts/payments";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const [{ id }, body] = await Promise.all([params, readJsonObject(request)]);
    const result = await respondToPayment(user.id, {
      paymentId: id,
      decision: body.decision,
      reason: body.reason,
    });
    return Response.json({ data: result.payment });
  } catch (error) {
    return debtErrorResponse(error, "Payment response");
  }
}
