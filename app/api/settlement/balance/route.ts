// GET /api/settlement/balance — compute current net balance for all members

import { requireAuth } from "@/lib/session";
import { currentMonthStart, currentMonthEnd, currentMonthKey } from "@/lib/utils/dates";
import { fetchMonthBalances } from "@/lib/queries/balance";

export async function GET() {
  try {
    await requireAuth();

    const result = await fetchMonthBalances({
      monthStart: currentMonthStart(),
      monthEnd: currentMonthEnd(),
      monthDate: new Date(currentMonthKey()),
      isCurrentMonth: true,
    });

    return Response.json({
      data: {
        balances: result.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          status: m.status,
          balance: m.balance.toFixed(2),
          breakdown: {
            bazarContributed: m.breakdown.bazarContributed.toFixed(2),
            maidPayments: m.breakdown.maidPayments.toFixed(2),
            fridgePayments: m.breakdown.fridgePayments.toFixed(2),
            bulkPurchases: m.breakdown.bulkPurchases.toFixed(2),
            mealCost: m.breakdown.mealCost.toFixed(2),
            maidCharge: m.breakdown.maidCharge.toFixed(2),
            fridgeBillShare: m.breakdown.fridgeBillShare.toFixed(2),
            bulkAllocations: m.breakdown.bulkAllocations.toFixed(2),
          },
        })),
        mealRate: result.mealRate?.toFixed(4) ?? null,
        totalMonthBazar: result.totalMonthBazar.toFixed(2),
        totalMonthMeals: result.totalMonthMeals,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
