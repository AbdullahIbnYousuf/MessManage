import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MembershipRequestsClient from "@/components/domain/admin/MembershipRequestsClient";
import { PageHeader } from "@/components/ui/Editorial";

export const metadata = {
  title: "Membership requests",
};

export default async function MembershipPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <PageHeader eyebrow="Administration" title="Membership requests" description="Approve or reject pending sign-up requests." />

      <MembershipRequestsClient />
    </div>
  );
}
