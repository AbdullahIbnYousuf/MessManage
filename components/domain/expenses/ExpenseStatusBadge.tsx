export type ExpenseStatusTone = "success" | "neutral" | "attention";

export default function ExpenseStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: ExpenseStatusTone;
}) {
  return <span className={`expense-status expense-status--${tone}`}>{label}</span>;
}
