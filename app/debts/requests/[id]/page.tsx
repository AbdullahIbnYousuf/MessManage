import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DebtRequestDetailClient from "@/components/domain/debts/DebtRequestDetailClient";

export const metadata = { title: "Debt request — DebtSync" };

export default async function DebtRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  const { id } = await params;
  return <DebtRequestDetailClient requestId={id} currentUserId={user.id} />;
}
