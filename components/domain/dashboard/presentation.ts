import type { NavigationIconName } from "@/components/navigation/config";
import type {
  HomeAttentionItem,
  HomeMealState,
} from "@/types/home";

export type HomeTone = "neutral" | "success" | "attention" | "danger";

export function formatHomeDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDeadline(deadline: string): string {
  const [hour, minute] = deadline.split(":").map(Number) as [number, number];
  const date = new Date(Date.UTC(2000, 0, 1, hour, minute));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

export function mealStatePresentation(
  state: HomeMealState,
  deadline: string
): { label: string; description: string; tone: HomeTone } {
  const deadlineLabel = formatDeadline(deadline);
  switch (state) {
    case "missing":
      return {
        label: "Not set",
        description: "Open Meals to prepare today’s record.",
        tone: "attention",
      };
    case "editable":
      return {
        label: "Editable",
        description: `You can update today’s count until ${deadlineLabel}.`,
        tone: "success",
      };
    case "request_required":
      return {
        label: "Deadline passed",
        description: "Propose the corrected count in Meals for admin review.",
        tone: "attention",
      };
    case "request_pending":
      return {
        label: "Request pending",
        description: "An admin is reviewing your proposed meal correction.",
        tone: "attention",
      };
    case "request_approved":
      return {
        label: "Edit approved",
        description: "Update today’s meal count before midnight.",
        tone: "success",
      };
    case "request_rejected":
      return {
        label: "Request rejected",
        description: "Today’s recorded count remains unchanged.",
        tone: "danger",
      };
    case "locked":
      return {
        label: "Locked",
        description: "This meal record is permanently locked for member edits.",
        tone: "neutral",
      };
  }
}

export function attentionPresentation(item: HomeAttentionItem): {
  title: string;
  description: string;
  icon: NavigationIconName;
  tone: HomeTone;
} {
  const plural = item.count === 1 ? "" : "s";
  switch (item.kind) {
    case "meal_edit_approved":
      return {
        title: "Update today’s meal count",
        description: "Your edit request was approved. Make the change before midnight.",
        icon: "meals",
        tone: "success",
      };
    case "payment_response":
      return {
        title: `${item.count} payment record${plural} need your response`,
        description: "Confirm or reject the records before they affect confirmed balances.",
        icon: "money",
        tone: "attention",
      };
    case "bazar_assignment":
      return {
        title: "You’re suggested for the active bazar trip",
        description: "Check the shared shopping notes and coordinate with the household.",
        icon: "bazar",
        tone: "attention",
      };
    case "admin_meal_edits":
      return {
        title: `${item.count} meal correction request${plural} pending`,
        description: "Review the exact meal corrections proposed by members.",
        icon: "meals",
        tone: "attention",
      };
    case "admin_memberships":
      return {
        title: `${item.count} membership request${plural} pending`,
        description: "Review who is waiting to join the household.",
        icon: "members",
        tone: "attention",
      };
    case "closing_blocked":
      return {
        title: "Previous month cannot close yet",
        description: `${item.count} ${item.count === 1 ? "issue needs" : "issues need"} review before monthly closing.`,
        icon: "closing",
        tone: "danger",
      };
    case "closing_ready":
      return {
        title: "Previous month is ready to close",
        description: "Review the final balances before running the permanent closing.",
        icon: "closing",
        tone: "success",
      };
    case "bulk_cycle_missing":
      return {
        title: `${item.count} bulk item${plural} without an active cycle`,
        description: "Review whether a new consumption cycle should be recorded.",
        icon: "bulk",
        tone: "attention",
      };
    case "fridge_bill_missing":
      return {
        title: "Previous month’s fridge bill is not posted",
        description: "Review the meter reading and bill when they are available.",
        icon: "fridge",
        tone: "attention",
      };
    case "maid_not_applied":
      return {
        title: "Maid charges have not been applied",
        description: "This is optional; the month remains at zero if charges are skipped.",
        icon: "maid",
        tone: "neutral",
      };
  }
}
