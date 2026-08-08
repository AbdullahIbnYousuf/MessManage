import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MoneyOverviewClient from "@/components/domain/money/MoneyOverviewClient";

export const metadata = {
  title: "Monthly balance",
  description: "Review the provisional household balance and monthly closing.",
};

export default async function HouseholdMoneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return <MoneyOverviewClient currentUserId={user.id} isAdmin={user.role === "admin"} />;
}
