import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import NotificationsClient from "@/components/domain/debts/NotificationsClient";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  return <NotificationsClient />;
}
