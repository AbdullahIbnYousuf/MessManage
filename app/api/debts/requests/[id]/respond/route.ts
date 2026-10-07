import { withMemberRoute } from "@/lib/utils/acting-route";
import {
  debtErrorResponse,
  readJsonObject,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { respondToDebtRequest } from "@/lib/services/debts/requests";

async function postHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const [{ id }, body] = await Promise.all([params, readJsonObject(request)]);
    const result = await respondToDebtRequest(user.id, {
      requestId: id,
      decision: body.decision,
      reason: body.reason,
    });
    return Response.json({ data: result.request });
  } catch (error) {
    return debtErrorResponse(error, "Debt request response");
  }
}

export const POST = withMemberRoute("request.respond", postHandler);
