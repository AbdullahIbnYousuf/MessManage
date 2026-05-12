import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import DashboardClient from "@/components/domain/dashboard/DashboardClient";

import { previousMonthKey, previousMonthStart } from "@/lib/utils/dates";

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

  const now = new Date();
  const day = now.getDate();
  const isAlertPeriod = day >= 1 && day <= 4;

  let isPreviousMonthSettled = false;
  const prevMonthLabel = previousMonthStart().toLocaleString("en-US", { month: "long", year: "numeric" });

  if (isAlertPeriod) {
    const prevKey = previousMonthKey();
    const settlementExists = await db.monthlySettlement.findFirst({
      where: { month: new Date(prevKey) },
      select: { id: true },
    });
    isPreviousMonthSettled = !!settlementExists;
  }

  return (
    <DashboardClient 
      userId={sessionUser.id} 
      name={sessionUser.name} 
      nickname={dbUser?.nickname ?? null}
      isAlertPeriod={isAlertPeriod}
      isPreviousMonthSettled={isPreviousMonthSettled}
      previousMonthLabel={prevMonthLabel}
    />
  );
}
