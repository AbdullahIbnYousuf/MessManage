import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import FridgeClient from "@/components/domain/fridge/FridgeClient";
import { previousMonthStart } from "@/lib/utils/dates";

export const metadata = {
  title: "Fridge Bill — MealSync",
  description: "Track shared fridge electricity bills and payments.",
};

export default async function FridgePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const prevStart = previousMonthStart();
  const previousMonthLabel = prevStart.toLocaleString("en-US", { month: "long", year: "numeric" });

  return <FridgeClient previousMonthLabel={previousMonthLabel} />;
}
