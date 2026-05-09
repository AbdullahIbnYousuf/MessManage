import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MembersListClient from "@/components/domain/admin/MembersListClient";

export const metadata = {
  title: "Members — MealSync",
};

export default async function MembersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>All Members</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Manage member accounts and roles.
          </p>
        </div>
      </div>

      <MembersListClient currentUserId={user.id} />
    </div>
  );
}
