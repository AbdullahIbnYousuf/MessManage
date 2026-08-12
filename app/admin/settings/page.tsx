import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import SystemSettingsClient from "@/components/domain/admin/SystemSettingsClient";
import { PageHeader } from "@/components/ui/Editorial";

export const metadata = {
  title: "System settings",
};

export default async function SystemSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <PageHeader eyebrow="Administration" title="System settings" description="Configure global deadlines and household defaults." />
      <SystemSettingsClient />
    </div>
  );
}
