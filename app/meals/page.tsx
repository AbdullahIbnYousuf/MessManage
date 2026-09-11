import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getNow, getDhakaParts, today, toDateString } from "@/lib/utils/dates";
import MealsClient from "@/components/domain/meal/MealsClient";

export const metadata = {
  title: "Meals",
  description: "Track your daily meals and manage your meal pattern.",
};

export default async function MealsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  // Fetch server-owned calendar boundaries so navigation is stable on hydration.
  const [config, member] = await Promise.all([
    db.systemConfig.findFirst(),
    db.user.findUnique({
      where: { id: user.id },
      select: { joinedAt: true },
    }),
  ]);
  const deadline = config?.mealDeadline ?? "22:00";

  // Use getNow() so MOCK_CURRENT_TIME is respected in development
  const { y: year, m: month } = getDhakaParts(getNow());
  const joined = getDhakaParts(member?.joinedAt ?? getNow());
  const todayStr = today();

  return (
    <MealsClient
      deadline={deadline}
      initialYear={year}
      initialMonth={month}
      earliestYear={joined.y}
      earliestMonth={joined.m}
      joinedDate={toDateString(member?.joinedAt ?? getNow())}
      todayStr={todayStr}
      isAdmin={user.role === "admin"}
    />
  );
}
