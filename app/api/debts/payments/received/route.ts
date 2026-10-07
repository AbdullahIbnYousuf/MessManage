import { withMemberRoute } from "@/lib/utils/acting-route";
import {
  debtErrorResponse,
  readJsonObject,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { createReceivedMoney } from "@/lib/services/debts/payments";

async function postHandler(request: Request) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const body = await readJsonObject(request);
    const result = await createReceivedMoney(user.id, {
      senderUserId: body.senderUserId,
      amount: body.amount,
      description: body.description,
      clientRequestId: body.clientRequestId,
    });
    return Response.json(
      { data: result.payment },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return debtErrorResponse(error, "Received money creation");
  }
}

export const POST = withMemberRoute("payment.received", postHandler);
