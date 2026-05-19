import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeMaidCharge, validateMaidPayment } from "@/lib/domain/maid";

describe("computeMaidCharge", () => {
  it("returns default charge for active members", () => {
    expect(computeMaidCharge(new Decimal("700"), "active").toFixed(2)).toBe("700.00");
  });

  it("returns zero for deactivated members", () => {
    expect(computeMaidCharge(new Decimal("700"), "deactivated").toFixed(2)).toBe("0.00");
  });
});

describe("validateMaidPayment", () => {
  it("returns null for valid positive number", () => {
    expect(validateMaidPayment(2800)).toBeNull();
  });

  it("returns null for valid positive string", () => {
    expect(validateMaidPayment("2800")).toBeNull();
  });

  it("returns error for zero", () => {
    expect(validateMaidPayment(0)).toBe("Amount must be a positive number.");
  });

  it("returns error for negative", () => {
    expect(validateMaidPayment(-100)).toBe("Amount must be a positive number.");
  });

  it("returns error for non-number types", () => {
    expect(validateMaidPayment(null)).toBe("Amount must be a number.");
    expect(validateMaidPayment(undefined)).toBe("Amount must be a number.");
    expect(validateMaidPayment({})).toBe("Amount must be a number.");
  });

  it("returns error for NaN string", () => {
    expect(validateMaidPayment("abc")).toBe("Amount must be a positive number.");
  });
});
