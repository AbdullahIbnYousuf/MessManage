import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MembersDirectoryClient from "@/components/domain/members/MembersDirectoryClient";

export const metadata = {
  title: "Members — MealSync",
  description: "Household member directory.",
};

export default async function MembersDirectoryPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/login");

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Household Members</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            View profiles and contact details for everyone in the household.
          </p>
        </div>
      </div>

      <MembersDirectoryClient />
    </div>
  );
}
