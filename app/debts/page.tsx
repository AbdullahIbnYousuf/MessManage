import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DebtDashboardClient from "@/components/domain/debts/DebtDashboardClient";

export const metadata = { title: "Balances & Payments" };

export default async function DebtsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <DebtDashboardClient currentUserId={user.id} />;
}
