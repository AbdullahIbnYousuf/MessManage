import { parseUnreadOnly } from "@/lib/utils/debts-query";
import {
  debtErrorResponse,
  parseLimit,
  requireDebtUser,
} from "@/lib/utils/debts-api";
import { fetchDebtNotificationInbox } from "@/lib/queries/debt-notifications";

export async function GET(request: Request) {
  try {
    const user = await requireDebtUser();
    const params = new URL(request.url).searchParams;
    const data = await fetchDebtNotificationInbox({
      userId: user.id,
      unreadOnly: parseUnreadOnly(params.get("unreadOnly")),
      cursor: params.get("cursor") ?? undefined,
      limit: parseLimit(params.get("limit")),
    });
    return Response.json({ data });
  } catch (error) {
    return debtErrorResponse(error, "Debt notification inbox");
  }
}
