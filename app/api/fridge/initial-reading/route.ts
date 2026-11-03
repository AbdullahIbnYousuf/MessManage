import { requireAdmin } from "@/lib/session";
import { assertSameOrigin } from "@/lib/domain/acting";
import { saveInitialFridgeReading } from "@/lib/services/fridge-initial-reading";
import { withMemberRoute } from "@/lib/utils/acting-route";
import { financialErrorResponse } from "@/lib/utils/financial-api";

async function postHandler(request: Request) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(request);
    let body: unknown;
    try { body = await request.json(); } catch {
      return Response.json({ error: "Enter an initial meter reading." }, { status: 400 });
    }
    const reading = body && typeof body === "object" && "reading" in body ? body.reading : undefined;
    const data = await saveInitialFridgeReading(admin.id, reading);
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return financialErrorResponse(error, "Initial fridge reading");
  }
}

// Deliberately not on the delegated-mutation allowlist: setup requires a real admin.
export const POST = withMemberRoute("fridge.initial-reading", postHandler);
