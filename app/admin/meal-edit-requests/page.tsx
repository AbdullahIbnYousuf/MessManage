import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MealEditRequestsClient from "@/components/domain/admin/MealEditRequestsClient";
import { PageHeader } from "@/components/ui/Editorial";

export const metadata = {
  title: "Meal corrections",
};

export default async function MealEditRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <PageHeader eyebrow="Administration" title="Meal correction requests" description="Review the exact meal changes proposed by members." />
      <MealEditRequestsClient />
    </div>
  );
}
