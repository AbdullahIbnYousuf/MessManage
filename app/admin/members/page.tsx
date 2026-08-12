import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MembersListClient from "@/components/domain/admin/MembersListClient";
import { PageHeader } from "@/components/ui/Editorial";

export const metadata = {
  title: "Manage members",
};

export default async function MembersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <PageHeader eyebrow="Administration" title="All members" description="Manage member accounts, roles, and meal calendars." />

      <MembersListClient currentUserId={user.id} />
    </div>
  );
}
