import { redirect } from "next/navigation";
import DashboardClient from "@/components/domain/dashboard/DashboardClient";
import { getSessionUser } from "@/lib/session";

export const metadata = {
  title: "Home",
  description: "Today’s household meals, tasks, and monthly snapshot.",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  return <DashboardClient />;
}
