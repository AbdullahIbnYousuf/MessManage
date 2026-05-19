/**
 * Tests for the settlement domain logic.
 *
 * This is the most critical module — it handles real money.
 * computeSettlement() is the greedy matching algorithm.
 * computeNetBalance() is the per-user balance formula.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeSettlement, computeNetBalance } from "@/lib/domain/settlement";
import type { BalanceEntry } from "@/lib/domain/settlement";

// ─── Helper ──────────────────────────────────────────────────────────────────

function entry(userId: string, name: string, balance: string): BalanceEntry {
  return { userId, name, avatarUrl: null, balance: new Decimal(balance) };
}

// ─── computeSettlement ───────────────────────────────────────────────────────

describe("computeSettlement", () => {
  it("returns no transfers when all balances are zero", () => {
    const balances = [
      entry("a", "Alice", "0"),
      entry("b", "Bob", "0"),
    ];
    expect(computeSettlement(balances)).toEqual([]);
  });

  it("returns no transfers for an empty list", () => {
    expect(computeSettlement([])).toEqual([]);
  });

  it("handles a simple two-person settlement", () => {
    // Alice is owed 500, Bob owes 500
    const balances = [
      entry("a", "Alice", "500"),
      entry("b", "Bob", "-500"),
    ];
    const transfers = computeSettlement(balances);

    expect(transfers).toHaveLength(1);
    expect(transfers[0]!.fromUserId).toBe("b");
    expect(transfers[0]!.toUserId).toBe("a");
    expect(transfers[0]!.amount.toFixed(2)).toBe("500.00");
  });

  it("handles a three-person settlement", () => {
    // Alice +1000, Bob -600, Carol -400
    const balances = [
      entry("a", "Alice", "1000"),
      entry("b", "Bob", "-600"),
      entry("c", "Carol", "-400"),
    ];
    const transfers = computeSettlement(balances);

    // Greedy: Bob (-600) pays Alice first, then Carol (-400) pays remaining
    expect(transfers).toHaveLength(2);

    const totalTransferred = transfers.reduce(
      (sum, t) => sum.add(t.amount),
      new Decimal(0)
    );
    expect(totalTransferred.toFixed(2)).toBe("1000.00");
  });

  it("handles a four-person household scenario", () => {
    // Realistic: Rahim spent a lot (owed money), others owe
    const balances = [
      entry("rahim", "Rahim", "1500"),
      entry("karim", "Karim", "-300"),
      entry("jamal", "Jamal", "-700"),
      entry("nadia", "Nadia", "-500"),
    ];
    const transfers = computeSettlement(balances);

    // All debts should sum to credits
    const totalDebits = balances
      .filter((b) => b.balance.isNegative())
      .reduce((s, b) => s.add(b.balance.abs()), new Decimal(0));
    const totalCredits = balances
      .filter((b) => b.balance.isPositive())
      .reduce((s, b) => s.add(b.balance), new Decimal(0));

    expect(totalDebits.toFixed(2)).toBe(totalCredits.toFixed(2));

    // Total transferred should equal total debits
    const totalTransferred = transfers.reduce(
      (sum, t) => sum.add(t.amount),
      new Decimal(0)
    );
    expect(totalTransferred.toFixed(2)).toBe("1500.00");
  });

  it("handles decimal amounts precisely", () => {
    const balances = [
      entry("a", "Alice", "333.33"),
      entry("b", "Bob", "-166.67"),
      entry("c", "Carol", "-166.66"),
    ];
    const transfers = computeSettlement(balances);

    const totalTransferred = transfers.reduce(
      (sum, t) => sum.add(t.amount),
      new Decimal(0)
    );
    expect(totalTransferred.toFixed(2)).toBe("333.33");
  });

  it("does not mutate the original balance entries", () => {
    const balances = [
      entry("a", "Alice", "500"),
      entry("b", "Bob", "-500"),
    ];
    const originalAliceBalance = balances[0]!.balance.toString();
    const originalBobBalance = balances[1]!.balance.toString();

    computeSettlement(balances);

    expect(balances[0]!.balance.toString()).toBe(originalAliceBalance);
    expect(balances[1]!.balance.toString()).toBe(originalBobBalance);
  });

  it("handles when one person owes multiple people", () => {
    // Bob owes a lot, Alice and Carol are each owed some
    const balances = [
      entry("a", "Alice", "300"),
      entry("b", "Bob", "-800"),
      entry("c", "Carol", "500"),
    ];
    const transfers = computeSettlement(balances);

    // Bob should pay both Alice and Carol
    const bobTransfers = transfers.filter((t) => t.fromUserId === "b");
    expect(bobTransfers.length).toBeGreaterThanOrEqual(1);

    const totalFromBob = bobTransfers.reduce(
      (sum, t) => sum.add(t.amount),
      new Decimal(0)
    );
    expect(totalFromBob.toFixed(2)).toBe("800.00");
  });

  it("skips members with zero balance", () => {
    const balances = [
      entry("a", "Alice", "500"),
      entry("b", "Bob", "0"),
      entry("c", "Carol", "-500"),
    ];
    const transfers = computeSettlement(balances);

    // Bob should not appear in any transfer
    const bobInvolved = transfers.some(
      (t) => t.fromUserId === "b" || t.toUserId === "b"
    );
    expect(bobInvolved).toBe(false);
  });
});

// ─── computeNetBalance ───────────────────────────────────────────────────────

describe("computeNetBalance", () => {
  const ZERO = new Decimal(0);

  it("returns zero when all inputs are zero", () => {
    const balance = computeNetBalance({
      totalBazarSpend: ZERO,
      totalMaidPayments: ZERO,
      totalFridgePayments: ZERO,
      totalBulkPurchases: ZERO,
      totalMealCost: ZERO,
      totalMaidCharges: ZERO,
      totalFridgeBillShare: ZERO,
      totalBulkAllocations: ZERO,
    });
    expect(balance.isZero()).toBe(true);
  });

  it("returns positive when credits exceed debits", () => {
    // User spent 2000 on bazar but only consumed 1000 in meals
    const balance = computeNetBalance({
      totalBazarSpend: new Decimal("2000"),
      totalMaidPayments: ZERO,
      totalFridgePayments: ZERO,
      totalBulkPurchases: ZERO,
      totalMealCost: new Decimal("1000"),
      totalMaidCharges: ZERO,
      totalFridgeBillShare: ZERO,
      totalBulkAllocations: ZERO,
    });
    expect(balance.toFixed(2)).toBe("1000.00");
  });

  it("returns negative when debits exceed credits", () => {
    // User consumed 1500 in meals but contributed nothing
    const balance = computeNetBalance({
      totalBazarSpend: ZERO,
      totalMaidPayments: ZERO,
      totalFridgePayments: ZERO,
      totalBulkPurchases: ZERO,
      totalMealCost: new Decimal("1500"),
      totalMaidCharges: new Decimal("700"),
      totalFridgeBillShare: ZERO,
      totalBulkAllocations: ZERO,
    });
    expect(balance.toFixed(2)).toBe("-2200.00");
  });

  it("correctly sums all credit types", () => {
    const balance = computeNetBalance({
      totalBazarSpend: new Decimal("1000"),
      totalMaidPayments: new Decimal("2800"),
      totalFridgePayments: new Decimal("2400"),
      totalBulkPurchases: new Decimal("1400"),
      totalMealCost: ZERO,
      totalMaidCharges: ZERO,
      totalFridgeBillShare: ZERO,
      totalBulkAllocations: ZERO,
    });
    // 1000 + 2800 + 2400 + 1400 = 7600
    expect(balance.toFixed(2)).toBe("7600.00");
  });

  it("correctly sums all debit types", () => {
    const balance = computeNetBalance({
      totalBazarSpend: ZERO,
      totalMaidPayments: ZERO,
      totalFridgePayments: ZERO,
      totalBulkPurchases: ZERO,
      totalMealCost: new Decimal("1500"),
      totalMaidCharges: new Decimal("700"),
      totalFridgeBillShare: new Decimal("600"),
      totalBulkAllocations: new Decimal("350"),
    });
    // -(1500 + 700 + 600 + 350) = -3150
    expect(balance.toFixed(2)).toBe("-3150.00");
  });

  it("handles a realistic full scenario", () => {
    // Rahim: spent 5000 on bazar, paid 2800 maid, paid 2400 fridge
    // Consumed: 1200 meals, 700 maid charge, 600 fridge share, 350 bulk alloc
    const balance = computeNetBalance({
      totalBazarSpend: new Decimal("5000"),
      totalMaidPayments: new Decimal("2800"),
      totalFridgePayments: new Decimal("2400"),
      totalBulkPurchases: ZERO,
      totalMealCost: new Decimal("1200"),
      totalMaidCharges: new Decimal("700"),
      totalFridgeBillShare: new Decimal("600"),
      totalBulkAllocations: new Decimal("350"),
    });
    // Credits: 5000 + 2800 + 2400 = 10200
    // Debits:  1200 + 700 + 600 + 350 = 2850
    // Net: 10200 - 2850 = 7350
    expect(balance.toFixed(2)).toBe("7350.00");
  });

  it("handles precise decimal arithmetic without floating-point errors", () => {
    const balance = computeNetBalance({
      totalBazarSpend: new Decimal("0.1"),
      totalMaidPayments: new Decimal("0.2"),
      totalFridgePayments: ZERO,
      totalBulkPurchases: ZERO,
      totalMealCost: ZERO,
      totalMaidCharges: ZERO,
      totalFridgeBillShare: ZERO,
      totalBulkAllocations: ZERO,
    });
    // 0.1 + 0.2 must equal exactly 0.3, not 0.30000000000000004
    expect(balance.toFixed(2)).toBe("0.30");
    expect(balance.toString()).toBe("0.3");
  });
});
