import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getNow } from "@/lib/utils/dates";
import SettlementClient from "@/components/domain/settlement/SettlementClient";

export const metadata = {
  title: "Monthly closing",
  description: "View current balances and run the monthly closing.",
};

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const { month } = await searchParams;
  const initialMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "")
    ? month
    : undefined;

  const now = getNow();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

  return (
    <SettlementClient
      isAdmin={user.role === "admin"}
      monthName={monthName}
      initialMonth={initialMonth}
    />
  );
}
