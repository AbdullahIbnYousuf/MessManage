import Decimal from "decimal.js";

export class DebtValidationError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "DebtValidationError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePositiveAmount(value: unknown): Decimal {
  if (typeof value !== "string") {
    throw new DebtValidationError("Amount must be a decimal string.");
  }

  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new DebtValidationError(
      "Amount must be positive and have no more than two decimal places."
    );
  }

  const amount = new Decimal(normalized);
  if (amount.lte(0)) {
    throw new DebtValidationError("Amount must be greater than zero.");
  }
  return amount;
}

export function validateOptionalDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new DebtValidationError("Description must be text.");
  }

  const description = value.trim();
  if (description.length === 0) return null;
  if (description.length > 300) {
    throw new DebtValidationError("Description must be 300 characters or fewer.");
  }
  return description;
}

export function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new DebtValidationError(`${fieldName} must be a valid UUID.`);
  }
  return value;
}

export function validateRejectionReason(value: unknown): string {
  if (typeof value !== "string") {
    throw new DebtValidationError("A rejection reason is required.");
  }
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 300) {
    throw new DebtValidationError(
      "Rejection reason must be between 3 and 300 characters."
    );
  }
  return reason;
}

export function serializeMoney(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2);
}
