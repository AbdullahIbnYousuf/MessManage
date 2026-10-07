import { withPaymentAttribution } from "@/lib/utils/payment-attribution-route";
import { fetchDebtMemberStatement } from "@/lib/queries/debts";
import { parseUuidParam } from "@/lib/utils/debts-query";
import {
  debtErrorResponse,
  parseLimit,
  requireDebtUser,
} from "@/lib/utils/debts-api";

async function getAttributionHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const data = await fetchDebtMemberStatement({
      currentUserId: user.id,
      memberId: parseUuidParam(id, "memberId"),
      cursor: searchParams.get("cursor") ?? undefined,
      limit: parseLimit(searchParams.get("limit")),
    });
    return Response.json({ data });
  } catch (error) {
    return debtErrorResponse(error, "Member money statement");
  }
}

export const GET = withPaymentAttribution(getAttributionHandler);
