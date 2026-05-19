import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { today } from "@/lib/utils/dates";
import BulkItemsClient from "@/components/domain/bulk/BulkItemsClient";

export const metadata = {
  title: "Bulk Items — MealSync",
  description: "Track gas, rice, and other bulk purchases.",
};

export default async function BulkItemsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return <BulkItemsClient isAdmin={user.role === "admin"} currentUserId={user.id} todayStr={today()} />;
}
