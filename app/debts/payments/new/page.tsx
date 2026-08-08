import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import PaymentFormClient from "@/components/domain/debts/PaymentFormClient";

export const metadata = { title: "Record money" };

export default async function NewDebtPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; direction?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") {
    redirect("/money/household");
  }
  const params = await searchParams;
  const initialDirection =
    params.direction === "received"
      ? "received"
      : params.direction === "sent"
        ? "sent"
        : undefined;
  return (
    <PaymentFormClient
      currentUserId={user.id}
      initialMemberId={params.memberId}
      initialDirection={initialDirection}
    />
  );
}
