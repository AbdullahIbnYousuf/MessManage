import type { ExpensesSummary } from "@/types/expenses";
import type { NavigationIconName } from "@/components/navigation/config";

export type ExpenseReviewItem = {
  id: "bulk" | "maid" | "fridge";
  title: string;
  description: string;
  href: "/bulk-items" | "/maid" | "/fridge";
  icon: NavigationIconName;
};

export function buildExpenseReviewItems(
  summary: ExpensesSummary,
  isAdmin: boolean
): ExpenseReviewItem[] {
  const items: ExpenseReviewItem[] = [];

  if (summary.bulk.itemCount === 0) {
    items.push({
      id: "bulk",
      title: "No bulk items set up",
      description: isAdmin
        ? "Set up the first tracked item when the household is ready."
        : "No rice, gas, or other long-running purchase is being tracked yet.",
      href: "/bulk-items",
      icon: "bulk",
    });
  } else if (summary.bulk.missingCycleCount > 0) {
    const names = summary.bulk.missingItems.map((item) => item.name).join(", ");
    items.push({
      id: "bulk",
      title: `${summary.bulk.missingCycleCount} bulk ${summary.bulk.missingCycleCount === 1 ? "item has" : "items have"} no active cycle`,
      description: `${names}. Open Bulk items when the next purchase starts.`,
      href: "/bulk-items",
      icon: "bulk",
    });
  }

  if (summary.maid.status === "not_applied") {
    items.push({
      id: "maid",
      title: "No maid charges applied",
      description: isAdmin
        ? "Applying charges is optional; if you do nothing, this month stays at ৳0.00."
        : "No charges have been applied, so this month currently remains at ৳0.00.",
      href: "/maid",
      icon: "maid",
    });
  }

  if (summary.fridge.status === "not_posted") {
    items.push({
      id: "fridge",
      title: "Previous month’s fridge bill is not posted",
      description: "Open Fridge bill when the meter reading and unit price are ready.",
      href: "/fridge",
      icon: "fridge",
    });
  }

  return items;
}
