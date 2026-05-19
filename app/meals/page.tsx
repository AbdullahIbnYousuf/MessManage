import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getNow, getDhakaParts, today } from "@/lib/utils/dates";
import MealsClient from "@/components/domain/meal/MealsClient";

export const metadata = {
  title: "Meals — MealSync",
  description: "Track your daily meals and manage your meal pattern.",
};

export default async function MealsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  // Fetch system config for deadline — server side so no client fetch needed
  const config = await db.systemConfig.findFirst();
  const deadline = config?.mealDeadline ?? "22:00";

  // Use getNow() so MOCK_CURRENT_TIME is respected in development
  const { y: year, m: month } = getDhakaParts(getNow());
  const todayStr = today();

  return <MealsClient deadline={deadline} year={year} month={month} todayStr={todayStr} isAdmin={user.role === "admin"} />;
}
