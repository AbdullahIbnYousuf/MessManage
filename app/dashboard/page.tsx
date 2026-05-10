import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DashboardClient from "@/components/domain/dashboard/DashboardClient";

export const metadata = {
  title: "Dashboard — MealSync",
  description: "Your household meal and expense overview.",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return <DashboardClient userName={user.nickname || user.name} />;
}
