// POST /api/fridge/bill — post a fridge electricity bill for the previous month.
// Rules:
//   - Only the previous calendar month can be billed (never current or future).
//   - Only one bill per month — duplicates are blocked.
//   - totalAmount = (currentReading - previousReading) * unitPrice
//   - exact FridgeAllocation rows are frozen for members active during the bill month.
//   - Any member can post.

import { requireAuth } from "@/lib/session";
import {
  computeFridgeAllocations,
  computeTotalFromReadings,
  isMemberEligibleForFridgeBill,
} from "@/lib/domain/fridge";
import { previousMonthKey, previousMonthStart } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json() as {
      previousReading?: unknown;
      currentReading: unknown;
      unitPrice?: unknown; // optional — falls back to SystemConfig
    };

    // Validate currentReading
    if (body.currentReading === undefined || body.currentReading === null || body.currentReading === "") {
      return Response.json({ error: "currentReading is required." }, { status: 400 });
    }
    let currentReading: Decimal;
    try {
      currentReading = new Decimal(String(body.currentReading));
    } catch {
      return Response.json({ error: "Invalid currentReading." }, { status: 400 });
    }
    if (currentReading.lt(0)) {
      return Response.json({ error: "currentReading must be zero or greater." }, { status: 400 });
    }

    const monthKey = previousMonthKey();
    const monthDate = new Date(monthKey);
    const prevStart = previousMonthStart();
    let suppliedPreviousReading: Decimal | null = null;
    if (body.previousReading !== undefined && body.previousReading !== null && body.previousReading !== "") {
      try {
        suppliedPreviousReading = new Decimal(String(body.previousReading));
      } catch {
        return Response.json({ error: "Invalid previousReading." }, { status: 400 });
      }
    }

    let suppliedUnitPrice: Decimal | null = null;
    if (body.unitPrice !== undefined && body.unitPrice !== null && body.unitPrice !== "") {
      try {
        suppliedUnitPrice = new Decimal(String(body.unitPrice));
        if (suppliedUnitPrice.lte(0)) throw new Error();
      } catch {
        return Response.json({ error: "Invalid unitPrice." }, { status: 400 });
      }
    }

    const result = await withSerializableRetry(async (tx) => {
      await assertMonthOpen(tx, monthDate);
      const existing = await tx.fridgeBill.findUnique({ where: { month: monthDate } });
      if (existing) {
        throw Response.json(
          { error: "A fridge bill for this month has already been posted." },
          { status: 400 }
        );
      }

      let previousReading = suppliedPreviousReading;
      if (!previousReading) {
        const lastBill = await tx.fridgeBill.findFirst({ orderBy: { month: "desc" } });
        if (!lastBill) {
          throw Response.json(
            { error: "No previous bill found. Please provide the previous meter reading." },
            { status: 400 }
          );
        }
        previousReading = new Decimal(lastBill.currentReading.toString());
      }
      if (currentReading.lt(previousReading)) {
        throw Response.json(
          { error: "Current reading cannot be less than the previous reading." },
          { status: 400 }
        );
      }

      let unitPrice = suppliedUnitPrice;
      if (!unitPrice) {
        const config = await tx.systemConfig.findFirst();
        unitPrice = new Decimal(config?.electricityUnitPrice.toString() ?? "8");
      }
      const computedTotal = computeTotalFromReadings(previousReading, currentReading, unitPrice);
      if (!computedTotal || computedTotal.lte(0)) {
        throw Response.json(
          { error: "Computed bill amount is zero — check your meter readings." },
          { status: 400 }
        );
      }
      const totalAmount = computedTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const members = await tx.user.findMany({
        select: { id: true, joinedAt: true, deactivatedAt: true },
      });
      const eligibleMembers = members.filter((member) =>
        isMemberEligibleForFridgeBill(member.joinedAt, member.deactivatedAt, prevStart)
      );
      if (eligibleMembers.length === 0) {
        throw Response.json(
          { error: "No eligible members found for this month." },
          { status: 400 }
        );
      }
      const allocations = computeFridgeAllocations(
        totalAmount,
        eligibleMembers.map((member) => member.id)
      );
      const postedAt = new Date();
      const created = await tx.fridgeBill.create({
        data: {
          month: monthDate,
          previousReading,
          currentReading,
          unitPrice,
          totalAmount,
          memberCount: eligibleMembers.length,
          postedAt,
          postedById: user.id,
        },
      });

      await tx.fridgeAllocation.createMany({
        data: allocations.map((allocation) => ({
          billId: created.id,
          userId: allocation.userId,
          amount: allocation.amount,
          allocatedAt: postedAt,
        })),
      });

      return { bill: created, allocations };
    });

    const allocationAmounts = result.allocations.map((allocation) => allocation.amount);
    const { bill } = result;

    return Response.json({
      data: {
        id: bill.id,
        month: monthKey.slice(0, 7),
        previousReading: bill.previousReading.toFixed(2),
        currentReading: bill.currentReading.toFixed(2),
        unitPrice: bill.unitPrice.toFixed(4),
        totalAmount: bill.totalAmount.toFixed(2),
        memberCount: bill.memberCount,
        shareRange: {
          min: Decimal.min(...allocationAmounts).toFixed(2),
          max: Decimal.max(...allocationAmounts).toFixed(2),
        },
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Fridge bill creation");
  }
}
