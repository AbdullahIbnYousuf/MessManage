import { DebtError } from "@/lib/domain/debts/errors";
import { parseOptionalUuidParam, parseTransferStatus } from "@/lib/utils/debts-query";
import {
  debtErrorResponse,
  parseLimit,
  readJsonObject,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { fetchDebtPayments } from "@/lib/queries/debts";
import { createPayment } from "@/lib/services/debts/payments";

export async function GET(request: Request) {
  try {
    const user = await requireDebtUser();
    const params = new URL(request.url).searchParams;
    const directionValue = params.get("direction") ?? "all";
    if (!(["all", "incoming", "outgoing"] as const).includes(
      directionValue as "all" | "incoming" | "outgoing"
    )) {
      throw new DebtError("VALIDATION_ERROR", "Invalid payment direction.");
    }
    const data = await fetchDebtPayments({
      currentUserId: user.id,
      memberId: parseOptionalUuidParam(params.get("memberId"), "memberId"),
      direction: directionValue as "all" | "incoming" | "outgoing",
      status: parseTransferStatus(params.get("status")),
      cursor: params.get("cursor") ?? undefined,
      limit: parseLimit(params.get("limit")),
    });
    return Response.json({ data });
  } catch (error) {
    return debtErrorResponse(error, "Debt payments");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const body = await readJsonObject(request);
    const result = await createPayment(user.id, {
      receiverUserId: body.receiverUserId,
      amount: body.amount,
      description: body.description,
      clientRequestId: body.clientRequestId,
    });
    return Response.json(
      { data: result.payment },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return debtErrorResponse(error, "Payment creation");
  }
}
