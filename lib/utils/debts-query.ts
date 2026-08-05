import type { TransferStatus } from "@prisma/client";
import { DebtError } from "@/lib/domain/debts/errors";
import { validateUuid } from "@/lib/domain/debts/validation";
import { parseDateString } from "@/lib/utils/dates";

const TRANSFER_STATUSES: TransferStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
];

export function parseOptionalUuidParam(
  value: string | null,
  fieldName: string
): string | undefined {
  if (value === null) return undefined;
  try {
    return validateUuid(value, fieldName);
  } catch {
    throw new DebtError("VALIDATION_ERROR", `${fieldName} must be a valid UUID.`);
  }
}

export function parseTransferStatus(
  value: string | null
): TransferStatus | undefined {
  if (value === null) return undefined;
  if (!TRANSFER_STATUSES.includes(value as TransferStatus)) {
    throw new DebtError("VALIDATION_ERROR", "Invalid payment status.");
  }
  return value as TransferStatus;
}

export function parseDateParam(
  value: string | null,
  fieldName: string,
  endOfDay = false
): Date | undefined {
  if (value === null) return undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) {
    throw new DebtError(
      "VALIDATION_ERROR",
      `${fieldName} must use YYYY-MM-DD.`
    );
  }
  const date = parseDateString(value);
  if (date.toISOString().slice(0, 10) !== value) {
    throw new DebtError("VALIDATION_ERROR", `${fieldName} is not a valid date.`);
  }
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

export function parseMonthParam(value: string | null): Date | undefined {
  if (value === null) return undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new DebtError("VALIDATION_ERROR", "Month must use YYYY-MM.");
  }
  return new Date(`${value}-01T00:00:00.000Z`);
}

export function parseUnreadOnly(value: string | null): boolean {
  if (value === null || value === "false") return false;
  if (value === "true") return true;
  throw new DebtError("VALIDATION_ERROR", "unreadOnly must be true or false.");
}
