import { FinancialError } from "@/lib/domain/financial-errors";

export function financialErrorResponse(error: unknown, context: string): Response {
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
