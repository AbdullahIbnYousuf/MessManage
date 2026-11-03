import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  computeFridgeAllocations,
  computeTotalFromReadings,
  isMemberEligibleForFridgeBill,
  parseInitialFridgeReading,
  assertCanInitializeFridge,
  resolveFridgePreviousReading,
} from "@/lib/domain/fridge";

describe("initial meter reading", () => {
  it("accepts zero and exact decimal readings", () => {
    for (const value of ["0", "227", "227.25", "99999999.99", " 227.00 "]) {
      expect(parseInitialFridgeReading(value).eq(new Decimal(value.trim()))).toBe(true);
    }
  });

  it.each([undefined, null, 227, "", "-1", "NaN", "Infinity", "1e2", "227.001", "100000000", "1.2.3"])(
    "rejects an invalid reading: %s", (value) => {
      expect(() => parseInitialFridgeReading(value)).toThrow();
    }
  );

  it("permits setup only before any baseline or bill exists", () => {
    expect(() => assertCanInitializeFridge(false, false)).not.toThrow();
    expect(() => assertCanInitializeFridge(true, false)).toThrow();
    expect(() => assertCanInitializeFridge(false, true)).toThrow();
    expect(() => assertCanInitializeFridge(true, true)).toThrow();
  });

  const baseline = {
    initialReading: new Decimal("227"),
    initialMonth: new Date("2026-11-01T00:00:00Z"),
    lastReading: null,
    suppliedReading: null,
  };

  it("uses 227 for the first completed tracking month without creating charges", () => {
    const previous = resolveFridgePreviousReading({ ...baseline, billMonth: new Date("2026-11-01T00:00:00Z") });
    expect(previous?.toFixed(2)).toBe("227.00");
    expect(computeTotalFromReadings(previous!, new Decimal("250"), new Decimal("8"))?.toFixed(2)).toBe("184.00");
  });

  it("blocks billing October using a November starting reading, even with a supplied value", () => {
    expect(() => resolveFridgePreviousReading({ ...baseline,
      billMonth: new Date("2026-10-01T00:00:00Z"), suppliedReading: new Decimal("0"),
    })).toThrow();
  });

  it("does not allow a supplied reading to replace the saved baseline", () => {
    expect(resolveFridgePreviousReading({ ...baseline,
      billMonth: new Date("2026-11-01T00:00:00Z"), suppliedReading: new Decimal("0"),
    })?.toFixed(2)).toBe("227.00");
  });

  it("uses the latest actual bill after initialization and across year rollover", () => {
    expect(resolveFridgePreviousReading({ ...baseline,
      billMonth: new Date("2027-01-01T00:00:00Z"), lastReading: new Decimal("250.25"),
    })?.toFixed(2)).toBe("250.25");
  });

  it("preserves legacy bill behavior without a baseline", () => {
    const legacy = { billMonth: new Date("2026-10-01T00:00:00Z"), initialReading: null, initialMonth: null, lastReading: new Decimal("100"), suppliedReading: null };
    expect(resolveFridgePreviousReading(legacy)?.toString()).toBe("100");
    expect(resolveFridgePreviousReading({ ...legacy, suppliedReading: new Decimal("0") })?.toString()).toBe("0");
    expect(resolveFridgePreviousReading({ ...legacy, lastReading: null })).toBeNull();
  });
});

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

describe("computeFridgeAllocations", () => {
  it("splits evenly among members", () => {
    const allocations = computeFridgeAllocations(new Decimal("2400"), ["d", "b", "a", "c"]);
    expect(allocations.map((allocation) => allocation.amount.toFixed(2))).toEqual([
      "600.00",
      "600.00",
      "600.00",
      "600.00",
    ]);
  });

  it("returns no allocations for zero members", () => {
    expect(computeFridgeAllocations(new Decimal("2400"), [])).toEqual([]);
  });

  it("distributes remainder paisa deterministically and preserves the exact total", () => {
    const allocations = computeFridgeAllocations(new Decimal("100"), ["c", "a", "b"]);

    expect(allocations.map((allocation) => ({
      userId: allocation.userId,
      amount: allocation.amount.toFixed(2),
    }))).toEqual([
      { userId: "a", amount: "33.34" },
      { userId: "b", amount: "33.33" },
      { userId: "c", amount: "33.33" },
    ]);
    expect(
      allocations.reduce((sum, allocation) => sum.add(allocation.amount), new Decimal(0)).toFixed(2)
    ).toBe("100.00");
  });

  it("normalizes the bill total to two decimals before splitting", () => {
    const allocations = computeFridgeAllocations(new Decimal("10.005"), ["b", "a"]);
    expect(allocations.map((allocation) => allocation.amount.toFixed(2))).toEqual([
      "5.01",
      "5.00",
    ]);
  });

  it("deduplicates recipients", () => {
    expect(computeFridgeAllocations(new Decimal("10"), ["a", "a"]))
      .toHaveLength(1);
  });

  it("preserves the frozen recipient set when a correction recalculates amounts", () => {
    const original = computeFridgeAllocations(new Decimal("100"), ["member-c", "member-a"]);
    const corrected = computeFridgeAllocations(
      new Decimal("125"),
      original.map((allocation) => allocation.userId)
    );

    expect(corrected.map((allocation) => allocation.userId)).toEqual([
      "member-a",
      "member-c",
    ]);
    expect(
      corrected.reduce((sum, allocation) => sum.add(allocation.amount), new Decimal(0)).toFixed(2)
    ).toBe("125.00");
  });
});

describe("isMemberEligibleForFridgeBill", () => {
  const mayStart = new Date("2026-05-01T00:00:00.000Z");

  it("includes members active throughout the month", () => {
    expect(isMemberEligibleForFridgeBill(
      new Date("2026-04-10T12:00:00.000Z"),
      null,
      mayStart
    )).toBe(true);
  });

  it("includes a member who joins on the final day of the month", () => {
    expect(isMemberEligibleForFridgeBill(
      new Date("2026-05-31T23:59:59.000Z"),
      null,
      mayStart
    )).toBe(true);
  });

  it("excludes a member who joins after the bill month", () => {
    expect(isMemberEligibleForFridgeBill(
      new Date("2026-06-01T00:00:00.000Z"),
      null,
      mayStart
    )).toBe(false);
  });

  it("excludes a member deactivated before the bill month", () => {
    expect(isMemberEligibleForFridgeBill(
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z"),
      mayStart
    )).toBe(false);
  });

  it("includes a member deactivated on the first day of the bill month", () => {
    expect(isMemberEligibleForFridgeBill(
      new Date("2026-04-01T00:00:00.000Z"),
      mayStart,
      mayStart
    )).toBe(true);
  });
});
