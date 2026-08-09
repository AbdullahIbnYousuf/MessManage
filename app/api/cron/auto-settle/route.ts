// GET /api/cron/auto-settle — settle the previous calendar month.

import { runMonthSettlement } from "@/lib/services/run-month-settlement";
import { previousMonthKey } from "@/lib/utils/dates";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const result = await runMonthSettlement({
      monthKey: previousMonthKey(),
      trigger: "cron",
    });

    if (result.status === "already_settled") {
      return Response.json({ message: "Already settled for the previous month." });
    }
    if (result.status === "no_data") {
      return Response.json({ message: "No data to settle for the previous month." });
    }
    if (result.status === "blocked") {
      console.warn(
        "Auto-settlement skipped due to unbalanced aggregates:",
        result.reasons.join(" ")
      );
      return Response.json({
        message: `Auto-settlement skipped: ${result.reasons.join(" ")}`,
        code: result.code ?? "VALIDATION_ERROR",
      });
    }

    return Response.json({
      message: "Auto-settlement completed successfully.",
      transfers: result.transfers.map((transfer) => ({
        fromUserId: transfer.fromUserId,
        fromUserName: transfer.fromUserName,
        toUserId: transfer.toUserId,
        toUserName: transfer.toUserName,
        amount: transfer.amount.toFixed(2),
      })),
    });
  } catch (error) {
    console.error("Auto-settlement failed.", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
