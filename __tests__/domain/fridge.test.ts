import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeTotalFromReadings, computePerMemberAmount } from "@/lib/domain/fridge";

describe("computeTotalFromReadings", () => {
  it("computes total correctly", () => {
    const result = computeTotalFromReadings(new Decimal("1380"), new Decimal("1680"), new Decimal("8"));
    expect(result).not.toBeNull();
    expect(result!.toFixed(2)).toBe("2400.00");
  });

  it("returns zero when readings are equal", () => {
    const result = computeTotalFromReadings(new Decimal("1500"), new Decimal("1500"), new Decimal("8"));
    expect(result!.toFixed(2)).toBe("0.00");
  });

  it("returns null when current < previous (invalid)", () => {
    expect(computeTotalFromReadings(new Decimal("1700"), new Decimal("1500"), new Decimal("8"))).toBeNull();
  });

  it("handles decimal unit prices", () => {
    const result = computeTotalFromReadings(new Decimal("100"), new Decimal("200"), new Decimal("8.5"));
    expect(result!.toFixed(2)).toBe("850.00");
  });
});

describe("computePerMemberAmount", () => {
  it("splits evenly among members", () => {
    expect(computePerMemberAmount(new Decimal("2400"), 4)!.toFixed(2)).toBe("600.00");
  });

  it("returns null for zero members", () => {
    expect(computePerMemberAmount(new Decimal("2400"), 0)).toBeNull();
  });

  it("handles non-round division", () => {
    expect(computePerMemberAmount(new Decimal("1000"), 3)!.toNumber()).toBeCloseTo(333.333, 2);
  });

  it("handles single member", () => {
    expect(computePerMemberAmount(new Decimal("2400"), 1)!.toFixed(2)).toBe("2400.00");
  });
});
