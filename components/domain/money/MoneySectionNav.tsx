"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MoneySectionNav({ debtSyncEnabled }: { debtSyncEnabled: boolean }) {
  const pathname = usePathname();
  if (!debtSyncEnabled) return null;

  const debtsActive = pathname === "/money" || pathname.startsWith("/money/members/");
  return (
    <nav className="money-section-nav" aria-label="Money views">
      <Link href="/money" aria-current={debtsActive ? "page" : undefined}>
        Debts
      </Link>
      <Link
        href="/money/household"
        aria-current={pathname.startsWith("/money/household") ? "page" : undefined}
      >
        Monthly balance
      </Link>
    </nav>
  );
}
