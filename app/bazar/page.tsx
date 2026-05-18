import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { today } from "@/lib/utils/dates";
import BazarClient from "@/components/domain/bazar/BazarClient";

export const metadata = {
  title: "Bazar — MealSync",
  description: "Manage bazar trips and track contributions.",
};

export default async function BazarPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  return <BazarClient todayStr={today()} />;
}
