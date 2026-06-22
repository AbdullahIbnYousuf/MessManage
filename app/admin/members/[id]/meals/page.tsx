import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getDhakaParts, getNow, today } from "@/lib/utils/dates";
import AdminMemberMealsClient from "@/components/domain/admin/AdminMemberMealsClient";

export const metadata = {
  title: "Edit Member Meals — MealSync",
};

export default async function AdminMemberMealsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const now = getDhakaParts(getNow());

  return (
    <AdminMemberMealsClient
      memberId={id}
      initialYear={now.y}
      initialMonth={now.m}
      todayStr={today()}
    />
  );
}
