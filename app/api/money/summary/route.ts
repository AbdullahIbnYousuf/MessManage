import { fetchMoneySummary } from "@/lib/queries/money";
import { requireAuth } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireAuth();
    const confirmedMoneyEnabled = process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED === "true";
    return Response.json({
      data: await fetchMoneySummary({
        currentUserId: user.id,
        confirmedMoneyEnabled,
      }),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Money summary", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
