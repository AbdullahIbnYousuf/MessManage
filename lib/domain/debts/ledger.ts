import type {
  DebtLedgerCursor,
  DebtLedgerEntry,
  DebtLedgerPage,
} from "@/types/debts";
import { DebtValidationError } from "@/lib/domain/debts/validation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLedgerType(value: unknown): value is DebtLedgerCursor["type"] {
  return value === "obligation" || value === "payment";
}

function typeOrder(type: DebtLedgerCursor["type"]): number {
  return type === "payment" ? 1 : 0;
}

export function compareLedgerEntries(
  left: Pick<DebtLedgerEntry, "createdAt" | "type" | "id">,
  right: Pick<DebtLedgerEntry, "createdAt" | "type" | "id">
): number {
  const dateCompare = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (dateCompare !== 0) return dateCompare;

  const typeCompare = typeOrder(right.type) - typeOrder(left.type);
  if (typeCompare !== 0) return typeCompare;

  return right.id.localeCompare(left.id);
}

export function encodeLedgerCursor(entry: DebtLedgerEntry): string {
  const cursor: DebtLedgerCursor = {
    createdAt: entry.createdAt,
    type: entry.type,
    id: entry.id,
  };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeLedgerCursor(cursor: string): DebtLedgerCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );
    if (typeof parsed !== "object" || parsed === null) throw new Error();

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.createdAt !== "string"
      || !Number.isFinite(Date.parse(candidate.createdAt))
      || !isLedgerType(candidate.type)
      || typeof candidate.id !== "string"
      || !UUID_PATTERN.test(candidate.id)
    ) {
      throw new Error();
    }

    return {
      createdAt: new Date(candidate.createdAt).toISOString(),
      type: candidate.type,
      id: candidate.id,
    };
  } catch {
    throw new DebtValidationError("The ledger cursor is invalid.");
  }
}

export function paginateLedgerEntries(
  entries: DebtLedgerEntry[],
  limit: number,
  cursor?: string
): DebtLedgerPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new DebtValidationError("Limit must be between 1 and 50.");
  }

  const sorted = [...entries].sort(compareLedgerEntries);
  const decoded = cursor ? decodeLedgerCursor(cursor) : null;
  const remaining = decoded
    ? sorted.filter((entry) => compareLedgerEntries(entry, decoded) > 0)
    : sorted;
  const pageEntries = remaining.slice(0, limit);
  const hasMore = remaining.length > limit;

  return {
    entries: pageEntries,
    nextCursor: hasMore && pageEntries.length > 0
      ? encodeLedgerCursor(pageEntries[pageEntries.length - 1]!)
      : null,
  };
}
