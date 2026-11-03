export type FinancialErrorCode =
  | "MONTH_SETTLED"
  | "SETTLEMENT_MONTH_NOT_CLOSED"
  | "SETTLEMENT_UNBALANCED"
  | "BAZAR_TRIP_ALREADY_COMPLETED"
  | "BULK_CYCLE_ALREADY_ACTIVE"
  | "FRIDGE_READING_INVALID"
  | "FRIDGE_INITIAL_READING_EXISTS"
  | "FRIDGE_BILL_EXISTS"
  | "FRIDGE_READING_NOT_STARTED";

const STATUS_BY_CODE: Record<FinancialErrorCode, number> = {
  MONTH_SETTLED: 409,
  SETTLEMENT_MONTH_NOT_CLOSED: 400,
  SETTLEMENT_UNBALANCED: 409,
  BAZAR_TRIP_ALREADY_COMPLETED: 409,
  BULK_CYCLE_ALREADY_ACTIVE: 409,
  FRIDGE_READING_INVALID: 400,
  FRIDGE_INITIAL_READING_EXISTS: 409,
  FRIDGE_BILL_EXISTS: 409,
  FRIDGE_READING_NOT_STARTED: 409,
};

export class FinancialError extends Error {
  readonly code: FinancialErrorCode;
  readonly status: number;

  constructor(code: FinancialErrorCode, message: string) {
    super(message);
    this.name = "FinancialError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
