import { DebtError } from "@/lib/domain/debts/errors";
import {
  parseDateParam,
  parseOptionalUuidParam,
  parseTransferStatus,
} from "@/lib/utils/debts-query";
import {
  debtErrorResponse,
  parseLimit,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { fetchDebtLedger } from "@/lib/queries/debts";

export async function GET(request: Request) {
  try {
    await requireDebtUser();
    const params = new URL(request.url).searchParams;
    const typeValue = params.get("type") ?? "all";
    if (!(["all", "obligation", "payment"] as const).includes(
      typeValue as "all" | "obligation" | "payment"
    )) {
      throw new DebtError("VALIDATION_ERROR", "Invalid ledger entry type.");
    }
    const from = parseDateParam(params.get("from"), "from");
    const to = parseDateParam(params.get("to"), "to", true);
    const status = parseTransferStatus(params.get("status"));
    if (from && to && from > to) {
      throw new DebtError("VALIDATION_ERROR", "from cannot be after to.");
    }
    if (typeValue === "obligation" && status) {
      throw new DebtError(
        "VALIDATION_ERROR",
        "Payment status cannot filter obligation-only entries."
      );
    }

    const data = await fetchDebtLedger({
      memberId: parseOptionalUuidParam(params.get("memberId"), "memberId"),
      type: typeValue as "all" | "obligation" | "payment",
      status,
      from,
      to,
      cursor: params.get("cursor") ?? undefined,
      limit: parseLimit(params.get("limit")),
    });
    return Response.json({ data });
  } catch (error) {
    return debtErrorResponse(error, "Debt ledger");
  }
}
