import Link from "next/link";

export default function MoneyBackLink() {
  return (
    <Link href="/money" className="money-back-link">
      <span aria-hidden="true">←</span> Debts &amp; payments
    </Link>
  );
}
