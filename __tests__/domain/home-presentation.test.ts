import { describe, expect, it } from "vitest";
import {
  attentionPresentation,
  formatDeadline,
  formatHomeDate,
  mealStatePresentation,
} from "@/components/domain/dashboard/presentation";

describe("Home presentation", () => {
  it("formats date and deadline labels without the runtime timezone", () => {
    expect(formatHomeDate("2026-08-08")).toBe("Saturday, August 8, 2026");
    expect(formatDeadline("22:00")).toBe("10:00 PM");
  });

  it("gives missing records and approved requests unambiguous instructions", () => {
    expect(mealStatePresentation("missing", "22:00")).toMatchObject({
      label: "Not set",
      tone: "attention",
    });
    expect(mealStatePresentation("request_approved", "22:00")).toMatchObject({
      label: "Edit approved",
      tone: "success",
    });
  });

  it("uses counts in action copy", () => {
    expect(attentionPresentation({
      kind: "payment_response",
      count: 2,
      href: "/debts",
    }).title).toBe("2 payment records need your response");
  });
});
