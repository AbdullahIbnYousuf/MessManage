import {
  debtErrorResponse,
  readJsonObject,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { createReturnPayment } from "@/lib/services/debts/payments";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const [{ id }, body] = await Promise.all([params, readJsonObject(request)]);
    const result = await createReturnPayment(user.id, {
      paymentId: id,
      clientRequestId: body.clientRequestId,
    });
    return Response.json(
      { data: result.payment },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return debtErrorResponse(error, "Return payment creation");
  }
}
