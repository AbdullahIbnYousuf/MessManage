import { fetchHomeSummary } from "@/lib/queries/home";
import { requireAuth } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireAuth();
    return Response.json({
      data: await fetchHomeSummary({
        currentUser: user,
        confirmedMoneyEnabled:
          process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED === "true",
      }),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Home summary", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
