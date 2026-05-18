import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import DashboardClient from "@/components/domain/dashboard/DashboardClient";
import { previousMonthKey, previousMonthStart, getNow } from "@/lib/utils/dates";

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

  const now = getNow();
  const day = now.getDate();
  const isAlertPeriod = day >= 1 && day <= 4;
  const daysUntilSettle = 5 - day; // 4 on day 1, 1 on day 4, 0 on day 5
  const isMaidChargeAlertPeriod = day >= 25 && day <= 28;
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const dayName = now.toLocaleString("en-US", { weekday: "long" });

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

  // Check if maid charges already applied this month (so we don't show the notice unnecessarily)
  let isMaidChargeApplied = false;
  if (isMaidChargeAlertPeriod) {
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const chargeExists = await db.maidCharge.findFirst({
      where: { month: currentMonthDate },
      select: { id: true },
    });
    isMaidChargeApplied = !!chargeExists;
  }

  const daysUntilMaidCharge = 28 - day; // 0 on the 28th, positive before

  return (
    <DashboardClient
      userId={sessionUser.id}
      name={sessionUser.name}
      nickname={dbUser?.nickname ?? null}
      isAlertPeriod={isAlertPeriod}
      isPreviousMonthSettled={isPreviousMonthSettled}
      previousMonthLabel={prevMonthLabel}
      daysUntilSettle={daysUntilSettle}
      monthName={monthName}
      dayName={dayName}
      isMaidChargeAlertPeriod={isMaidChargeAlertPeriod}
      isMaidChargeApplied={isMaidChargeApplied}
      daysUntilMaidCharge={daysUntilMaidCharge}
    />
  );
}
