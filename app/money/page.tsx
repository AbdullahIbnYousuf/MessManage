import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MoneyOverviewClient from "@/components/domain/money/MoneyOverviewClient";

export const metadata = {
  title: "Money",
  description: "Understand monthly household balances and confirmed money between members.",
};

export default async function MoneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  return <MoneyOverviewClient currentUserId={user.id} isAdmin={user.role === "admin"} />;
}
