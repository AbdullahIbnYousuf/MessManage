import Link from "next/link";

export default function ExpensesBackLink() {
  return (
    <Link href="/expenses" className="expense-back-link">
      <span aria-hidden="true">←</span> Expenses
    </Link>
  );
}
