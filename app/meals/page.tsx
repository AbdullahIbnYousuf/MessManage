import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
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

  return <MealsClient deadline={deadline} />;
}
