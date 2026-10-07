import { describe, expect, it } from "vitest";
import { assertActingValidity, assertExpectedContext, assertSameOrigin, sameAdminConfirmedBothSides, validateActingReason } from "@/lib/domain/acting";

const valid = { actorId: "admin", actorRole: "admin", actorStatus: "active", memberStatus: "active",
  sessionAdminId: "admin", sessionBinding: "login", loginBinding: "login", endedAt: null,
  expiresAt: new Date("2026-10-07T12:30:00Z"), now: new Date("2026-10-07T12:00:00Z") };

describe("Act as member policy", () => {
  it("trims and bounds a required reason", () => {
    expect(validateActingReason("  Member left the household  ")).toBe("Member left the household");
    for (const value of [null, "", "ab", "a".repeat(301)]) expect(() => validateActingReason(value)).toThrow();
  });
  it("allows a valid delegation", () => expect(() => assertActingValidity(valid)).not.toThrow());
  it.each([
    { actorRole: "member" }, { actorStatus: "deactivated" }, { actorId: "someone-else" },
    { loginBinding: "new-login" }, { loginBinding: null }, { endedAt: new Date() }, { memberStatus: "deactivated" },
  ])("denies a revoked or mismatched identity: %j", (change) => {
    expect(() => assertActingValidity({ ...valid, ...change })).toThrow();
  });
  it("expires at exactly the deadline, without renewal", () => {
    expect(() => assertActingValidity({ ...valid, now: valid.expiresAt })).toThrow(/expired/);
  });
  it("rejects stale self/member screens and missing delegated context", () => {
    expect(() => assertExpectedContext("self", "delegated", true)).toThrow();
    expect(() => assertExpectedContext("delegated", "self")).toThrow();
    expect(() => assertExpectedContext(null, "delegated", true)).toThrow();
    expect(() => assertExpectedContext("delegated", "delegated", true)).not.toThrow();
    expect(() => assertExpectedContext(null, "self")).not.toThrow();
  });
  it.each([
    {}, { origin: "https://evil.example" }, { referer: "not-a-url" },
    { origin: "https://app.example", "sec-fetch-site": "cross-site" },
  ])("rejects cross-origin and missing-origin actions: %j", (headers) => {
    const clean = Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined)) as Record<string, string>;
    expect(() => assertSameOrigin(new Request("https://app.example/api/admin/acting-as", { headers: clean }))).toThrow();
  });
  it("permits same-origin requests, including the existing GET meal-generation flow", () => {
    expect(() => assertSameOrigin(new Request("https://app.example/api", { headers: { origin: "https://app.example" } }))).not.toThrow();
    expect(() => assertSameOrigin(new Request("https://app.example/api", { headers: { referer: "https://app.example/meals" } }))).not.toThrow();
  });
  it("identifies the same admin operating both participants without modifying initiation", () => {
    const payment = { initiatedBy: "sender" as const, sender: { id: "member-a" }, receiver: { id: "member-b" }, onBehalfActions: [
      { action: "payment.create", statusAfter: "pending", admin: { id: "admin" } },
      { action: "payment.respond", statusAfter: "accepted", admin: { id: "admin" } },
    ] };
    expect(sameAdminConfirmedBothSides(payment)).toBe(true);
    expect(sameAdminConfirmedBothSides({ ...payment, onBehalfActions: payment.onBehalfActions.map((action) => ({ ...action, statusAfter: "pending" })) })).toBe(false);
    expect(payment.initiatedBy).toBe("sender");
  });
  it("also attributes an admin's own original payment confirmed on behalf of the recipient", () => {
    expect(sameAdminConfirmedBothSides({ initiatedBy: "sender", sender: { id: "admin" }, receiver: { id: "member" },
      onBehalfActions: [{ action: "payment.respond", statusAfter: "accepted", admin: { id: "admin" } }] })).toBe(true);
  });
  it("discloses delegated creation followed by confirmation from the admin's own account", () => {
    const payment = { initiatedBy: "sender" as const, sender: { id: "member" }, receiver: { id: "admin" },
      onBehalfActions: [{ action: "payment.create", statusAfter: "pending", admin: { id: "admin" } }] };
    expect(sameAdminConfirmedBothSides({ ...payment, status: "accepted" })).toBe(true);
    expect(sameAdminConfirmedBothSides({ ...payment, status: "pending" })).toBe(false);
    expect(sameAdminConfirmedBothSides({ ...payment, status: "rejected" })).toBe(false);
    expect(sameAdminConfirmedBothSides({ ...payment, status: "accepted", receiver: { id: "someone-else" } })).toBe(false);
  });
});
