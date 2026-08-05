export type DebtErrorCode =
  | "AUTH_REQUIRED"
  | "ACCOUNT_INACTIVE"
  | "MEMBER_NOT_FOUND"
  | "SELF_PAYMENT_NOT_ALLOWED"
  | "INVALID_AMOUNT"
  | "INVALID_DESCRIPTION"
  | "DUPLICATE_REQUEST_CONFLICT"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_PENDING"
  | "PAYMENT_FORBIDDEN"
  | "REJECTION_REASON_REQUIRED"
  | "REVERSAL_NOT_ALLOWED"
  | "ACTIVE_REVERSAL_EXISTS"
  | "DEACTIVATION_BLOCKED_BY_DEBT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "FEATURE_DISABLED";

const STATUS_BY_CODE: Record<DebtErrorCode, number> = {
  AUTH_REQUIRED: 401,
  ACCOUNT_INACTIVE: 403,
  MEMBER_NOT_FOUND: 404,
  SELF_PAYMENT_NOT_ALLOWED: 400,
  INVALID_AMOUNT: 400,
  INVALID_DESCRIPTION: 400,
  DUPLICATE_REQUEST_CONFLICT: 409,
  PAYMENT_NOT_FOUND: 404,
  PAYMENT_NOT_PENDING: 409,
  PAYMENT_FORBIDDEN: 403,
  REJECTION_REASON_REQUIRED: 400,
  REVERSAL_NOT_ALLOWED: 409,
  ACTIVE_REVERSAL_EXISTS: 409,
  DEACTIVATION_BLOCKED_BY_DEBT: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  FEATURE_DISABLED: 503,
};

export class DebtError extends Error {
  readonly code: DebtErrorCode;
  readonly status: number;
  readonly details: Record<string, string | number> | undefined;

  constructor(
    code: DebtErrorCode,
    message: string,
    details?: Record<string, string | number>
  ) {
    super(message);
    this.name = "DebtError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}
