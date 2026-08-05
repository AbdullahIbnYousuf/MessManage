import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import PaymentFormClient from "@/components/domain/debts/PaymentFormClient";

export const metadata = { title: "Record money — DebtSync" };

export default async function NewDebtPaymentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <PaymentFormClient currentUserId={user.id} />;
}
