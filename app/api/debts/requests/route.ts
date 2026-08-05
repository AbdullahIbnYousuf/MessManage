import { DebtError } from "@/lib/domain/debts/errors";
import { fetchDebtRequests } from "@/lib/queries/debt-requests";
import { createDebtRequest } from "@/lib/services/debts/requests";
import {
  debtErrorResponse,
  parseLimit,
  readJsonObject,
  requireDebtMutationsEnabled,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { parseDebtRequestStatus } from "@/lib/utils/debts-query";

export async function GET(request: Request) {
  try {
    const user = await requireDebtUser();
    const params = new URL(request.url).searchParams;
    const direction = params.get("direction") ?? "all";
    if (!(direction === "all" || direction === "incoming" || direction === "outgoing")) {
      throw new DebtError("VALIDATION_ERROR", "Invalid debt request direction.");
    }
    const data = await fetchDebtRequests({
      userId: user.id,
      direction,
      status: parseDebtRequestStatus(params.get("status")),
      cursor: params.get("cursor") ?? undefined,
      limit: parseLimit(params.get("limit")),
    });
    return Response.json({ data });
  } catch (error) {
    return debtErrorResponse(error, "Debt requests");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireDebtUser();
    requireDebtMutationsEnabled();
    const body = await readJsonObject(request);
    const result = await createDebtRequest(user.id, {
      debtorUserId: body.debtorUserId,
      amount: body.amount,
      description: body.description,
      clientRequestId: body.clientRequestId,
    });
    return Response.json(
      { data: result.request },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return debtErrorResponse(error, "Debt request creation");
  }
}
