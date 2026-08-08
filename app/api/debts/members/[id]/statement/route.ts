import { fetchDebtMemberStatement } from "@/lib/queries/debts";
import { parseUuidParam } from "@/lib/utils/debts-query";
import {
  debtErrorResponse,
  parseLimit,
  requireDebtUser,
} from "@/lib/utils/debts-api";

export async function GET(
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
