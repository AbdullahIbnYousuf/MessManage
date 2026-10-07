import { cookies } from "next/headers";
import { getIdentityContext } from "@/lib/services/acting-identity";
import { startActing, endActing } from "@/lib/services/acting-sessions";
import { actingErrorResponse } from "@/lib/utils/acting-route";
import { ACTING_COOKIE, ACTING_CONTEXT_HEADER, assertExpectedContext, assertSameOrigin, ActingError } from "@/lib/domain/acting";

export async function GET() {
  try {
    const context = await getIdentityContext();
    if (!context.actor) return Response.json({ error: "Unauthorised" }, { status: 401 });
    return Response.json({ data: { acting: context.acting, error: context.error, contextId: context.acting?.id ?? "self" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return actingErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await getIdentityContext();
    assertSameOrigin(request);
    assertExpectedContext(request.headers.get(ACTING_CONTEXT_HEADER), context.acting?.id ?? "self", true);
    let body: { memberId?: unknown; reason?: unknown };
    try { body = await request.json(); } catch { throw new ActingError("VALIDATION_ERROR", "Invalid request body.", 400); }
    if (!body || typeof body !== "object") throw new ActingError("VALIDATION_ERROR", "Invalid request body.", 400);
    const session = await startActing(context, body.memberId, body.reason);
    (await cookies()).set(ACTING_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    // A browser-session cookie survives server expiry so stale forms cannot silently become admin actions.
    return Response.json({ data: { id: session.id, expiresAt: session.expiresAt, admin: session.admin, member: session.member } }, { status: 201 });
  } catch (error) { return actingErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const context = await getIdentityContext();
    assertSameOrigin(request);
    if (!context.actor) throw new ActingError("AUTH_REQUIRED", "Authentication is required.", 401);
    if (!context.error) assertExpectedContext(request.headers.get(ACTING_CONTEXT_HEADER), context.acting?.id ?? "self", true);
    const jar = await cookies();
    const token = jar.get(ACTING_COOKIE)?.value;
    await endActing(context, token);
    jar.delete(ACTING_COOKIE);
    return Response.json({ data: { ended: true } });
  } catch (error) { return actingErrorResponse(error); }
}
