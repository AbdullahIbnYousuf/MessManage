import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import PaymentDetailClient from "@/components/domain/debts/PaymentDetailClient";

export const metadata = { title: "Payment record" };

export default async function DebtPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  const { id } = await params;
  return <PaymentDetailClient paymentId={id} currentUserId={user.id} />;
}
