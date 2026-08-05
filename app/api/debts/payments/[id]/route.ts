import { DebtError } from "@/lib/domain/debts/errors";
import { fetchDebtPaymentDetail } from "@/lib/queries/debts";
import {
  debtErrorResponse,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { parseUuidParam } from "@/lib/utils/debts-query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDebtUser();
    const { id } = await params;
    const payment = await fetchDebtPaymentDetail(parseUuidParam(id, "payment id"));
    if (!payment) throw new DebtError("PAYMENT_NOT_FOUND", "Payment not found.");
    return Response.json({ data: payment });
  } catch (error) {
    return debtErrorResponse(error, "Payment detail");
  }
}
