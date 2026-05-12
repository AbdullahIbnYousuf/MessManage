// Pure business logic for the Fridge system.
// No HTTP, no database calls — just formulas and rule checks.

import Decimal from "decimal.js";
import { div } from "@/lib/utils/decimal";

/**
 * Computes the per-member share of a fridge bill.
 * Splits the total equally among the count of eligible members.
 * Returns null if memberCount is 0 (no members — should not happen).
 */
export function computePerMemberAmount(
  totalAmount: Decimal,
  memberCount: number
): Decimal | null {
  if (memberCount === 0) return null;
  return div(totalAmount, memberCount);
}
