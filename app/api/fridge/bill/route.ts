// POST /api/fridge/bill — post a fridge electricity bill for the previous month.
// Rules:
//   - Only the previous calendar month can be billed (never current or future).
//   - Only one bill per month — duplicates are blocked.
//   - totalAmount = (currentReading - previousReading) * unitPrice
//   - exact FridgeAllocation rows are frozen for members active during the bill month.
//   - Any member can post.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import {
  computeFridgeAllocations,
  computeTotalFromReadings,
  isMemberEligibleForFridgeBill,
} from "@/lib/domain/fridge";
import { previousMonthKey, previousMonthStart } from "@/lib/utils/dates";
import Decimal from "decimal.js";

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

    // Block duplicate bill for this month
    const existing = await db.fridgeBill.findUnique({ where: { month: monthDate } });
    if (existing) {
      return Response.json({ error: "A fridge bill for this month has already been posted." }, { status: 400 });
    }

    const settled = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
      select: { id: true },
    });
    if (settled) {
      return Response.json(
        { error: "This month has already been settled. A fridge bill can no longer be posted." },
        { status: 409 }
      );
    }

    // Resolve previousReading: from body (first bill) or last bill's currentReading
    let previousReading: Decimal;
    if (body.previousReading !== undefined && body.previousReading !== null && body.previousReading !== "") {
      try {
        previousReading = new Decimal(String(body.previousReading));
      } catch {
        return Response.json({ error: "Invalid previousReading." }, { status: 400 });
      }
    } else {
      // Pull from the most recent bill
      const lastBill = await db.fridgeBill.findFirst({ orderBy: { month: "desc" } });
      if (!lastBill) {
        return Response.json({ error: "No previous bill found. Please provide the previous meter reading." }, { status: 400 });
      }
      previousReading = new Decimal(lastBill.currentReading.toString());
    }

    if (currentReading.lt(previousReading)) {
      return Response.json({ error: "Current reading cannot be less than the previous reading." }, { status: 400 });
    }

    // Resolve unitPrice: from body or SystemConfig
    let unitPrice: Decimal;
    if (body.unitPrice !== undefined && body.unitPrice !== null && body.unitPrice !== "") {
      try {
        unitPrice = new Decimal(String(body.unitPrice));
        if (unitPrice.lte(0)) throw new Error();
      } catch {
        return Response.json({ error: "Invalid unitPrice." }, { status: 400 });
      }
    } else {
      const config = await db.systemConfig.findFirst();
      unitPrice = new Decimal(config?.electricityUnitPrice.toString() ?? "8");
    }

    // Compute total
    const computedTotal = computeTotalFromReadings(previousReading, currentReading, unitPrice);
    if (!computedTotal) {
      return Response.json({ error: "Failed to compute total amount." }, { status: 500 });
    }

    if (computedTotal.lte(0)) {
      return Response.json({ error: "Computed bill amount is zero — check your meter readings." }, { status: 400 });
    }

    const totalAmount = computedTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Freeze the exact members who were active at any point during the bill month.
    const members = await db.user.findMany({
      select: { id: true, joinedAt: true, deactivatedAt: true },
    });
    const eligibleMembers = members.filter((member) =>
      isMemberEligibleForFridgeBill(member.joinedAt, member.deactivatedAt, prevStart)
    );

    const memberCount = eligibleMembers.length;
    if (memberCount === 0) {
      return Response.json({ error: "No eligible members found for this month." }, { status: 400 });
    }

    const allocations = computeFridgeAllocations(
      totalAmount,
      eligibleMembers.map((member) => member.id)
    );
    const postedAt = new Date();

    const bill = await db.$transaction(async (tx) => {
      const created = await tx.fridgeBill.create({
        data: {
          month: monthDate,
          previousReading,
          currentReading,
          unitPrice,
          totalAmount,
          memberCount,
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

      return created;
    });

    const allocationAmounts = allocations.map((allocation) => allocation.amount);

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
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
