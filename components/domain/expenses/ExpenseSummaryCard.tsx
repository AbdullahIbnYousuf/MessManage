import Link from "next/link";
import NavIcon from "@/components/navigation/NavIcon";
import type { NavigationIconName } from "@/components/navigation/config";
import ExpenseStatusBadge, {
  type ExpenseStatusTone,
} from "@/components/domain/expenses/ExpenseStatusBadge";

export default function ExpenseSummaryCard({
  title,
  icon,
  status,
  tone,
  href,
  actionLabel,
  children,
}: {
  title: string;
  icon: NavigationIconName;
  status: string;
  tone: ExpenseStatusTone;
  href: "/bulk-items" | "/maid" | "/fridge";
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="expense-summary-card">
      <div className="expense-summary-card__header">
        <span className="expense-summary-card__icon">
          <NavIcon name={icon} size={20} />
        </span>
        <h2>{title}</h2>
        <ExpenseStatusBadge label={status} tone={tone} />
      </div>
      <div className="expense-summary-card__body">{children}</div>
      <Link href={href} className="btn btn-secondary expense-summary-card__action">
        {actionLabel}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
