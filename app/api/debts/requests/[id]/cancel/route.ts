import {
  debtErrorResponse,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { cancelDebtRequest } from "@/lib/services/debts/requests";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const { id } = await params;
    const result = await cancelDebtRequest(user.id, id);
    return Response.json({ data: result.request });
  } catch (error) {
    return debtErrorResponse(error, "Debt request cancellation");
  }
}
