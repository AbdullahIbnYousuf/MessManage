import { requireAdmin } from "@/lib/session";
import { actingActionHistory } from "@/lib/services/acting-sessions";
import { actingErrorResponse } from "@/lib/utils/acting-route";
import { parseUuidParam } from "@/lib/utils/debts-query";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = new URL(request.url).searchParams;
    const memberId = query.get("memberId");
    return Response.json({ data: await actingActionHistory(memberId ? parseUuidParam(memberId, "member id") : undefined, query.get("cursor")) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return actingErrorResponse(error); }
}
