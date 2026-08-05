import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import ReceivedMoneyFormClient from "@/components/domain/debts/ReceivedMoneyFormClient";

export const metadata = { title: "Record money received — DebtSync" };

export default async function NewReceivedMoneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <ReceivedMoneyFormClient currentUserId={user.id} />;
}
