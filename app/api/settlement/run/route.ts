// POST /api/settlement/run — run month-end settlement (admin only)

import { requireAdmin } from "@/lib/session";
import { runMonthSettlement } from "@/lib/services/run-month-settlement";
import { currentMonthKey } from "@/lib/utils/dates";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    let monthKey = currentMonthKey();

    try {
      const body = await request.json() as { month?: unknown };
      if (body.month !== undefined) {
        if (
          typeof body.month !== "string"
          || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)
        ) {
          return Response.json(
            { error: "Invalid month format. Use YYYY-MM." },
            { status: 400 }
          );
        }
        monthKey = `${body.month}-01`;
      }
    } catch {
      // An empty body keeps the current-month default.
    }

    const result = await runMonthSettlement({
      monthKey,
      trigger: "manual",
      actorId: admin.id,
    });

    if (result.status === "already_settled") {
      return Response.json(
        { error: "This month has already been settled.", code: "MONTH_SETTLED" },
        { status: 409 }
      );
    }
    if (result.status === "no_data") {
      return Response.json(
        { error: "There is no data to settle for this month." },
        { status: 400 }
      );
    }
    if (result.status === "blocked") {
      return Response.json(
        {
          error: `Settlement blocked: ${result.reasons.join(" ")}`,
          code: result.code ?? "VALIDATION_ERROR",
        },
        { status: result.code === "SETTLEMENT_UNBALANCED" ? 409 : 400 }
      );
    }

    return Response.json({
      data: {
        month: result.month.slice(0, 7),
        transfers: result.transfers.map((transfer) => ({
          fromUserId: transfer.fromUserId,
          fromUserName: transfer.fromUserName,
          toUserId: transfer.toUserId,
          toUserName: transfer.toUserName,
          amount: transfer.amount.toFixed(2),
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Manual settlement failed.", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
