import type {
  CurrentMoneyDirection,
  PreviousClosingStatus,
} from "@/types/money";

export function currentBalanceLabel(direction: CurrentMoneyDirection): string {
  if (direction === "owed") return "You are currently owed";
  if (direction === "owes") return "You currently owe";
  return "Your current balance is even";
}

export function closingPresentation(
  status: PreviousClosingStatus,
  isAdmin: boolean,
  issueCount: number
): { label: string; title: string; description: string; tone: "success" | "neutral" | "attention" | "danger" } {
  if (status === "closed") {
    return {
      label: "Closed",
      title: "Previous month is closed",
      description: "Its final balances are permanent and have moved into confirmed money.",
      tone: "success",
    };
  }
  if (status === "blocked") {
    return {
      label: "Needs review",
      title: "Monthly closing is blocked",
      description: `${issueCount} ${issueCount === 1 ? "issue needs" : "issues need"} attention before the month can close.`,
      tone: "danger",
    };
  }
  if (status === "no_activity") {
    return {
      label: "No activity",
      title: "Nothing to close",
      description: "No financial activity was recorded for the previous month.",
      tone: "neutral",
    };
  }
  return {
    label: "Ready",
    title: isAdmin ? "Previous month is ready to close" : "Waiting for monthly closing",
    description: isAdmin
      ? "Review the final balances before running the permanent monthly closing."
      : "An admin or the scheduled closing process can make these balances permanent.",
    tone: "attention",
  };
}
