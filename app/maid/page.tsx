import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { currentMonthKey } from "@/lib/utils/dates";
import MaidClient from "@/components/domain/maid/MaidClient";

export const metadata = {
  title: "Maid — MealSync",
  description: "Track monthly maid charges and payments.",
};

export default async function MaidPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const config = await db.systemConfig.findFirst();
  const defaultCharge = config?.maidChargeDefault.toFixed(2) ?? "700.00";
  const monthKey = currentMonthKey();

  return (
    <MaidClient
      isAdmin={user.role === "admin"}
      currentMonthKey={monthKey}
      defaultCharge={defaultCharge}
    />
  );
}
