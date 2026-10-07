import { requireAuth } from "@/lib/session";
import { actingActionHistory } from "@/lib/services/acting-sessions";
import { actingErrorResponse } from "@/lib/utils/acting-route";

export async function GET(request: Request) {
  try {
    const member = await requireAuth();
    return Response.json({ data: await actingActionHistory(member.id, new URL(request.url).searchParams.get("cursor")) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return actingErrorResponse(error); }
}
