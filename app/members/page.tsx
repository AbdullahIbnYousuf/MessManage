import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MembersDirectoryClient from "@/components/domain/members/MembersDirectoryClient";
import { PageHeader } from "@/components/ui/Editorial";

export const metadata = {
  title: "Members",
  description: "Household member directory.",
};

export default async function MembersDirectoryPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/login");

  return (
    <div className="page-container">
      <PageHeader eyebrow="Your household" title="Members" description="Profiles and contact details for everyone in the household." />

      <MembersDirectoryClient />
    </div>
  );
}
