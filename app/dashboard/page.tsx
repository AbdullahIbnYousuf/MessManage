import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import DashboardClient from "@/components/domain/dashboard/DashboardClient";

export const metadata = {
  title: "Dashboard — MealSync",
  description: "Your household meal and expense overview.",
};

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/login");

  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { nickname: true },
  });

  return <DashboardClient userId={sessionUser.id} name={sessionUser.name} nickname={dbUser?.nickname ?? null} />;
}
