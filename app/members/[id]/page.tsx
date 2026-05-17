import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MemberProfileClient from "@/components/domain/members/MemberProfileClient";

export const metadata = {
  title: "Member Profile — MealSync",
};

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/login");
  
  const { id } = await params;

  return <MemberProfileClient targetUserId={id} currentUserId={sessionUser.id} />;
}
