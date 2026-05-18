import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import FridgeClient from "@/components/domain/fridge/FridgeClient";
import { previousMonthStart, previousMonthKey } from "@/lib/utils/dates";

export const metadata = {
  title: "Fridge Bill — MealSync",
  description: "Track shared fridge electricity bills and payments.",
};

export default async function FridgePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const prevStart = previousMonthStart();
  const previousMonthLabel = prevStart.toLocaleString("en-US", { month: "long", year: "numeric" });
  const prevMonthKey = previousMonthKey().slice(0, 7);

  // Get the most recent bill's currentReading (becomes previousReading for the next bill)
  const lastBill = await db.fridgeBill.findFirst({ orderBy: { month: "desc" } });
  const lastCurrentReading = lastBill ? lastBill.currentReading.toFixed(2) : null;

  // Get default unit price from SystemConfig
  const config = await db.systemConfig.findFirst();
  const defaultUnitPrice = config?.electricityUnitPrice.toFixed(4) ?? "8.0000";

  return (
    <FridgeClient
      previousMonthLabel={previousMonthLabel}
      prevMonthKey={prevMonthKey}
      lastCurrentReading={lastCurrentReading}
      defaultUnitPrice={defaultUnitPrice}
    />
  );
}
