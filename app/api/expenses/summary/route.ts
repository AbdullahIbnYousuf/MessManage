import { requireAuth } from "@/lib/session";
import { fetchExpensesSummary } from "@/lib/queries/expenses";

export async function GET() {
  try {
    await requireAuth();
    return Response.json({ data: await fetchExpensesSummary() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Expenses summary", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
