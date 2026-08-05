import { DebtError } from "@/lib/domain/debts/errors";
import { fetchDebtRequestDetail } from "@/lib/queries/debt-requests";
import { debtErrorResponse, requireDebtUser } from "@/lib/utils/debts-api";
import { parseUuidParam } from "@/lib/utils/debts-query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    const { id } = await params;
    const request = await fetchDebtRequestDetail(
      user.id,
      parseUuidParam(id, "request id")
    );
    if (!request) throw new DebtError("DEBT_REQUEST_NOT_FOUND", "Debt request not found.");
    return Response.json({ data: request });
  } catch (error) {
    return debtErrorResponse(error, "Debt request detail");
  }
}
