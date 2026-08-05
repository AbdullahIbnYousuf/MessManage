import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DebtLedgerClient from "@/components/domain/debts/DebtLedgerClient";
import { Suspense } from "react";

export const metadata = { title: "Ledger — DebtSync" };

export default async function DebtLedgerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <Suspense fallback={<div className="page-container debt-state"><span className="spinner" /> Loading ledger…</div>}><DebtLedgerClient /></Suspense>;
}
