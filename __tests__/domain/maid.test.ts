import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  computeMaidCharge,
  isMemberEligibleForMaidCharge,
  maidServiceMonthForAccountingMonth,
  usesDeferredMaidAccounting,
  validateMaidPayment,
} from "@/lib/domain/maid";

describe("maidServiceMonthForAccountingMonth", () => {
  it("associates July service with August accounting", () => {
    expect(maidServiceMonthForAccountingMonth(new Date("2026-08-01T00:00:00.000Z")))
      .toEqual(new Date("2026-07-01T00:00:00.000Z"));
  });

  it("handles December service in January accounting", () => {
    expect(maidServiceMonthForAccountingMonth(new Date("2027-01-01T00:00:00.000Z")))
      .toEqual(new Date("2026-12-01T00:00:00.000Z"));
  });

  it("keeps pre-cutover accounting months in the legacy period", () => {
    expect(usesDeferredMaidAccounting(new Date("2026-07-01T00:00:00.000Z"))).toBe(false);
    expect(usesDeferredMaidAccounting(new Date("2026-08-01T00:00:00.000Z"))).toBe(true);
  });
});

describe("computeMaidCharge", () => {
  it("returns default charge for active members", () => {
    expect(computeMaidCharge(new Decimal("700"), "active").toFixed(2)).toBe("700.00");
  });

  it("returns zero for deactivated members", () => {
    expect(computeMaidCharge(new Decimal("700"), "deactivated").toFixed(2)).toBe("0.00");
  });
});

describe("isMemberEligibleForMaidCharge", () => {
  const month = new Date("2026-07-01T00:00:00.000Z");

  it("includes a member active during the requested month", () => {
    expect(isMemberEligibleForMaidCharge(new Date("2026-06-10"), null, month)).toBe(true);
  });

  it("excludes a member who joined after the requested month", () => {
    expect(isMemberEligibleForMaidCharge(new Date("2026-08-01"), null, month)).toBe(false);
  });

  it("includes a member deactivated during the requested month", () => {
    expect(isMemberEligibleForMaidCharge(
      new Date("2026-05-01"),
      new Date("2026-07-15"),
      month
    )).toBe(true);
  });

  it("excludes a member deactivated before the requested month", () => {
    expect(isMemberEligibleForMaidCharge(
      new Date("2026-05-01"),
      new Date("2026-06-30"),
      month
    )).toBe(false);
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
