import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DebtDashboardClient from "@/components/domain/debts/DebtDashboardClient";

export const metadata = {
  title: "Debts & payments",
  description: "Review confirmed debts and payments between household members.",
};

export default async function MoneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") {
    redirect("/money/household");
  }

  return <DebtDashboardClient currentUserId={user.id} />;
}
