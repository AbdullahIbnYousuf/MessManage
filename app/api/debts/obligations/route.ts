import { parseMonthParam, parseOptionalUuidParam } from "@/lib/utils/debts-query";
import {
  debtErrorResponse,
  parseLimit,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { fetchDebtObligations } from "@/lib/queries/debts";

export async function GET(request: Request) {
  try {
    await requireDebtUser();
    const params = new URL(request.url).searchParams;
    const data = await fetchDebtObligations({
      memberId: parseOptionalUuidParam(params.get("memberId"), "memberId"),
      month: parseMonthParam(params.get("month")),
      cursor: params.get("cursor") ?? undefined,
      limit: parseLimit(params.get("limit")),
    });
    return Response.json({ data });
  } catch (error) {
    return debtErrorResponse(error, "Debt obligations");
  }
}
