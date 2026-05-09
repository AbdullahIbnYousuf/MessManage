import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import SystemSettingsClient from "@/components/domain/admin/SystemSettingsClient";

export const metadata = {
  title: "System Settings — MealSync",
};

export default async function SystemSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>System Settings</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Configure global deadlines and defaults for the household.
          </p>
        </div>
      </div>
      <SystemSettingsClient />
    </div>
  );
}
