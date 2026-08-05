import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DebtRequestsClient from "@/components/domain/debts/DebtRequestsClient";

export const metadata = { title: "Debt requests — DebtSync" };

export default async function DebtRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <Suspense fallback={<div className="page-container debt-state"><span className="spinner" /> Loading requests…</div>}><DebtRequestsClient currentUserId={user.id} /></Suspense>;
}
