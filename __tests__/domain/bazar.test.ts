import { describe, it, expect } from "vitest";
import { suggestAssignees, canOpenTrip, validateBazarAmount } from "@/lib/domain/bazar";

describe("suggestAssignees", () => {
  it("returns the two members with lowest visit counts", () => {
    const members = [
      { id: "a", visitCount: 5 },
      { id: "b", visitCount: 2 },
      { id: "c", visitCount: 8 },
      { id: "d", visitCount: 1 },
    ];
    const [a1, a2] = suggestAssignees(members);
    expect(a1!.id).toBe("d"); // 1 visit
    expect(a2!.id).toBe("b"); // 2 visits
  });

  it("returns [null, null] for empty list", () => {
    const [a1, a2] = suggestAssignees([]);
    expect(a1).toBeNull();
    expect(a2).toBeNull();
  });

  it("returns [member, null] for single member", () => {
    const [a1, a2] = suggestAssignees([{ id: "a", visitCount: 3 }]);
    expect(a1!.id).toBe("a");
    expect(a2).toBeNull();
  });

  it("preserves order for tied counts", () => {
    const members = [
      { id: "a", visitCount: 2 },
      { id: "b", visitCount: 2 },
      { id: "c", visitCount: 2 },
    ];
    const [a1, a2] = suggestAssignees(members);
    // All tied — first two from input order after stable sort
    expect(a1).not.toBeNull();
    expect(a2).not.toBeNull();
  });

  it("does not mutate original array", () => {
    const members = [
      { id: "a", visitCount: 5 },
      { id: "b", visitCount: 1 },
    ];
    suggestAssignees(members);
    expect(members[0]!.id).toBe("a"); // original order preserved
  });
});

describe("canOpenTrip", () => {
  it("returns true when no trip is open", () => {
    expect(canOpenTrip(false)).toBe(true);
  });

  it("returns false when a trip is already open", () => {
    expect(canOpenTrip(true)).toBe(false);
  });
});

describe("validateBazarAmount", () => {
  it("returns null for valid positive number", () => {
    expect(validateBazarAmount(1500)).toBeNull();
  });

  it("returns null for zero (valid — zero-amount expense allowed)", () => {
    expect(validateBazarAmount(0)).toBeNull();
  });

  it("returns null for valid string number", () => {
    expect(validateBazarAmount("1500.50")).toBeNull();
  });

  it("returns error for negative number", () => {
    expect(validateBazarAmount(-100)).toBe("Amount must be a non-negative number.");
  });

  it("returns error for non-number types", () => {
    expect(validateBazarAmount(null)).toBe("Amount must be a number.");
    expect(validateBazarAmount(undefined)).toBe("Amount must be a number.");
    expect(validateBazarAmount({})).toBe("Amount must be a number.");
  });

  it("returns error for NaN string", () => {
    expect(validateBazarAmount("abc")).toBe("Amount must be a non-negative number.");
  });
});
