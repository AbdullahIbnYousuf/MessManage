import { FinancialError } from "@/lib/domain/financial-errors";
import { ActingError } from "@/lib/domain/acting";

export function financialErrorResponse(error: unknown, context: string): Response {
  if (error instanceof Response) return error;
  if (error instanceof ActingError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof FinancialError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error(`${context} failed.`, error);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
