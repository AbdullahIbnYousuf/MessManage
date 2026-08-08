import type { ReactNode } from "react";
import MoneySectionNav from "@/components/domain/money/MoneySectionNav";

export default function MoneyLayout({ children }: { children: ReactNode }) {
  const debtSyncEnabled = process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED === "true";
  return (
    <div className="page-container money-shell">
      <MoneySectionNav debtSyncEnabled={debtSyncEnabled} />
      {children}
    </div>
  );
}
