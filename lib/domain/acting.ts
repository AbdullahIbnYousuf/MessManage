export const ACTING_COOKIE = "mm-acting";
export const ACTING_CONTEXT_HEADER = "x-mm-context";
export const ACTING_DURATION_MS = 30 * 60 * 1000;

export class ActingError extends Error {
  constructor(readonly code: string, message: string, readonly status = 403) {
    super(message);
  }
}

export function validateActingReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 300) {
    throw new ActingError("ACTING_REASON_INVALID", "Enter a reason between 3 and 300 characters.", 400);
  }
  return value.trim();
}

export function assertActingValidity(input: {
  actorId: string; actorRole: string; actorStatus: string; memberStatus: string;
  sessionAdminId: string; sessionBinding: string; loginBinding: string | null;
  endedAt: Date | null; expiresAt: Date; now?: Date;
}): void {
  if (input.actorStatus !== "active" || input.actorRole !== "admin" || input.actorId !== input.sessionAdminId
    || !input.loginBinding || input.loginBinding !== input.sessionBinding || input.endedAt) {
    throw new ActingError("ACTING_SESSION_INVALID", "Acting access is no longer valid. Return to your account.");
  }
  if (input.expiresAt <= (input.now ?? new Date())) {
    throw new ActingError("ACTING_SESSION_EXPIRED", "Acting access has expired. Return to your account.", 409);
  }
  if (input.memberStatus !== "active") {
    throw new ActingError("ACTING_MEMBER_INACTIVE", "This member is no longer active.");
  }
}

export function assertExpectedContext(expected: string | null, actual: string, required = false): void {
  if ((required && !expected) || (expected !== null && expected !== actual)) {
    throw new ActingError("ACTING_CONTEXT_CHANGED", "The account context changed. Reload before continuing.", 409);
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const expected = new URL(request.url).origin;
  let refererOrigin: string | null = null;
  try { refererOrigin = referer ? new URL(referer).origin : null; } catch { /* reject malformed origins */ }
  if (origin ? origin !== expected : refererOrigin !== expected) {
    throw new ActingError("ACTING_ORIGIN_FORBIDDEN", "This action must be performed from MessManage.");
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ActingError("ACTING_ORIGIN_FORBIDDEN", "Cross-origin actions are not permitted.");
  }
}

export function sameAdminConfirmedBothSides(payment: {
  initiatedBy: "sender" | "receiver"; sender: { id: string }; receiver: { id: string }; status?: string;
  onBehalfActions?: { action: string; statusAfter: string | null; admin: { id: string } }[];
}): boolean {
  const initiator = payment.initiatedBy === "receiver" ? payment.receiver.id : payment.sender.id;
  const confirmer = payment.initiatedBy === "receiver" ? payment.sender.id : payment.receiver.id;
  const creation = payment.onBehalfActions?.find((action) => ["payment.create", "payment.received", "payment.reverse"].includes(action.action));
  const response = payment.onBehalfActions?.find((action) => action.action === "payment.respond" && action.statusAfter === "accepted");
  if (!creation && !response) return false;
  if (!response && payment.status !== "accepted") return false;
  return (creation?.admin.id ?? initiator) === (response?.admin.id ?? confirmer);
}
