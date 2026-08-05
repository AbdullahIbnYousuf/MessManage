import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import RequestDebtFormClient from "@/components/domain/debts/RequestDebtFormClient";

export const metadata = { title: "Request debt — DebtSync" };

export default async function NewDebtRequestPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <RequestDebtFormClient currentUserId={user.id} />;
}
