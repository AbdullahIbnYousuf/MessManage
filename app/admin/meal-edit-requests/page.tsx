import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MealEditRequestsClient from "@/components/domain/admin/MealEditRequestsClient";
import { PageHeader } from "@/components/ui/Editorial";

export const metadata = {
  title: "Meal edit requests",
};

export default async function MealEditRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <PageHeader eyebrow="Administration" title="Meal edit requests" description="Review requests to change today’s meal count after the deadline." />
      <MealEditRequestsClient />
    </div>
  );
}
