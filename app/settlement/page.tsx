import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getNow } from "@/lib/utils/dates";
import SettlementClient from "@/components/domain/settlement/SettlementClient";

export const metadata = {
  title: "Monthly closing",
  description: "View current balances and run the monthly closing.",
};

export default async function SettlementPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const now = getNow();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

  return <SettlementClient isAdmin={user.role === "admin"} monthName={monthName} />;
}
