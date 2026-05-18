import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getNow } from "@/lib/utils/dates";
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
  const now = getNow();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return <MealsClient deadline={deadline} year={year} month={month} todayStr={todayStr} isAdmin={user.role === "admin"} />;
}
