import { allowedActingOperations, actingOperations } from "@/lib/services/acting-context";
import { ACTING_CONTEXT_HEADER, ActingError, assertExpectedContext, assertSameOrigin } from "@/lib/domain/acting";
import { deliverDebtNotifications } from "@/lib/services/debts/notifications";

export function actingErrorResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof ActingError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("Acting operation failed", error);
  return Response.json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export function withMemberRoute<T extends (...args: never[]) => Promise<Response>>(operation: string, handler: T): T {
  return (async (...args: unknown[]) => {
    try {
      const first = args[0];
      const hasActingCookie = first instanceof Request && /(?:^|;\s*)mm-acting=/.test(first.headers.get("cookie") ?? "");
      const expected = first instanceof Request ? first.headers.get(ACTING_CONTEXT_HEADER) : null;
      if (!hasActingCookie && (!expected || expected === "self")) {
        return await (handler as unknown as (...values: unknown[]) => Promise<Response>)(...args);
      }
      const { getIdentityContext } = await import("@/lib/services/acting-identity");
      const identity = await getIdentityContext();
      if (identity.error) throw new ActingError(identity.error.code, identity.error.message, 409);
      const request = args[0];
      if (!(request instanceof Request)) throw new ActingError("ACTING_CONTEXT_CHANGED", "Reload before continuing.", 409);
      assertExpectedContext(request.headers.get(ACTING_CONTEXT_HEADER), identity.acting?.id ?? "self", Boolean(identity.acting));
      if (identity.acting) {
        if (!allowedActingOperations.has(operation)) throw new ActingError("ACTING_ACTION_FORBIDDEN", "This operation is not available while acting.");
        assertSameOrigin(request);
      }
      const scope = { identity, operation, notificationIds: [] as string[] };
      const response = await actingOperations.run(scope, () => (handler as unknown as (...values: unknown[]) => Promise<Response>)(...args));
      // Delivery happens only after transaction commit, and cannot turn a committed action into a failed response.
      try { await deliverDebtNotifications(scope.notificationIds); } catch (error) { console.error("On-behalf push delivery failed", error); }
      return response;
    } catch (error) { return actingErrorResponse(error); }
  }) as unknown as T;
}
