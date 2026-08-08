import { redirect } from "next/navigation";
import DebtMemberStatementClient from "@/components/domain/debts/DebtMemberStatementClient";
import { getSessionUser } from "@/lib/session";

export const metadata = {
  title: "Member money statement",
  description: "Review a confirmed money position with another household member.",
};

export default async function MemberMoneyStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/money/household");
  const { id } = await params;
  return <DebtMemberStatementClient memberId={id} currentUserId={user.id} />;
}
