import { getSessionUser } from "@/lib/session";
import { DebtError } from "@/lib/domain/debts/errors";
import { DebtValidationError } from "@/lib/domain/debts/validation";
import type { SessionUser } from "@/types";

export async function requireDebtUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new DebtError("AUTH_REQUIRED", "Authentication is required.");
  if (user.status !== "active") {
    throw new DebtError("ACCOUNT_INACTIVE", "This account is inactive.");
  }
  return user;
}

export function requireDebtMutationsEnabled(): void {
  if (process.env.DEBTSYNC_MUTATIONS_ENABLED !== "true") {
    throw new DebtError(
      "FEATURE_DISABLED",
      "Money changes are temporarily disabled."
    );
  }
}

export function debtErrorResponse(error: unknown, context: string): Response {
  if (error instanceof DebtValidationError) {
    return Response.json(
      { error: error.message, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  if (error instanceof DebtError) {
    return Response.json(
      { error: error.message, code: error.code, ...error.details },
      { status: error.status }
    );
  }

  console.error(`${context} failed.`, error);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error();
    }
    return value as Record<string, unknown>;
  } catch {
    throw new DebtError("VALIDATION_ERROR", "A valid JSON object is required.");
  }
}

export function parseLimit(value: string | null): number {
  if (value === null) return 25;
  if (!/^\d+$/.test(value)) {
    throw new DebtError("VALIDATION_ERROR", "Limit must be between 1 and 50.");
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new DebtError("VALIDATION_ERROR", "Limit must be between 1 and 50.");
  }
  return limit;
}
