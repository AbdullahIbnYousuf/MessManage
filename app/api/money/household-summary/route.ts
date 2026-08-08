import { fetchHouseholdMoneySummary } from "@/lib/queries/money";
import { requireAuth } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireAuth();
    return Response.json({
      data: await fetchHouseholdMoneySummary({ currentUserId: user.id }),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Household money summary", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
