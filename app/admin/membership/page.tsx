import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MembershipRequestsClient from "@/components/domain/admin/MembershipRequestsClient";

export const metadata = {
  title: "Membership Requests — MealSync",
};

export default async function MembershipPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Membership Requests</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Approve or reject pending sign-up requests.
          </p>
        </div>
      </div>

      <MembershipRequestsClient />
    </div>
  );
}
