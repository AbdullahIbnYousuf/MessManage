import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import Decimal from "decimal.js";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    let config = await db.systemConfig.findFirst();
    if (!config) {
      config = await db.systemConfig.create({
        data: { mealDeadline: "22:00", maidChargeDefault: new Decimal(700) },
      });
    }

    return Response.json({
      data: {
        mealDeadline: config.mealDeadline,
        maidChargeDefault: config.maidChargeDefault.toString(),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json() as { mealDeadline?: string; maidChargeDefault?: string };
    
    let config = await db.systemConfig.findFirst();
    if (!config) {
      config = await db.systemConfig.create({
        data: { mealDeadline: "22:00", maidChargeDefault: new Decimal(700) },
      });
    }

    const updateData: { mealDeadline?: string; maidChargeDefault?: Decimal } = {};
    if (body.mealDeadline !== undefined) {
      // Basic validation for HH:mm
      if (!/^\d{2}:\d{2}$/.test(body.mealDeadline)) {
        return Response.json({ error: "Invalid time format. Use HH:mm" }, { status: 400 });
      }
      updateData.mealDeadline = body.mealDeadline;
    }
    
    if (body.maidChargeDefault !== undefined) {
      try {
        const val = new Decimal(body.maidChargeDefault);
        if (val.isNegative()) throw new Error();
        updateData.maidChargeDefault = val;

        // Reset maid charges for the current month to 0 so they can be reapplied
        const { currentMonthKey } = await import("@/lib/utils/dates");
        const monthDate = new Date(currentMonthKey());
        await db.maidCharge.updateMany({
          where: { month: monthDate },
          data: { amount: 0 },
        });
      } catch {
        return Response.json({ error: "Invalid maid charge amount" }, { status: 400 });
      }
    }

    await db.systemConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
