import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MealEditRequestsClient from "@/components/domain/admin/MealEditRequestsClient";

export const metadata = {
  title: "Meal Edit Requests — MealSync",
};

export default async function MealEditRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Meal Edit Requests</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Approve or reject members&apos; requests to edit today&apos;s meal count after the deadline.
          </p>
        </div>
      </div>
      <MealEditRequestsClient />
    </div>
  );
}
