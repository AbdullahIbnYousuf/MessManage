import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import NavIcon from "@/components/navigation/NavIcon";
import { PageHeader } from "@/components/ui/Editorial";
import type { NavigationIconName } from "@/components/navigation/config";

export const metadata = {
  title: "Admin Panel",
};

const destinations: Array<{
  href: string;
  title: string;
  description: string;
  icon: NavigationIconName;
}> = [
  {
    href: "/admin/membership",
    title: "Membership requests",
    description: "Review pending sign-up requests.",
    icon: "members",
  },
  {
    href: "/admin/members",
    title: "All members",
    description: "Manage accounts, roles, and meal calendars.",
    icon: "profile",
  },
  {
    href: "/admin/meal-edit-requests",
    title: "Meal correction requests",
    description: "Review exact changes proposed by members.",
    icon: "meals",
  },
  {
    href: "/admin/settings",
    title: "System settings",
    description: "Configure household deadlines and defaults.",
    icon: "admin",
  },
];

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Household administration"
        title="Admin panel"
        description="Membership, member access, meal corrections, and system settings."
      />

      <div className="admin-hub-grid">
        {destinations.map((destination) => (
          <Link className="admin-hub-card" href={destination.href} key={destination.href}>
            <span className="admin-hub-card__icon"><NavIcon name={destination.icon} size={20} /></span>
            <span>
              <strong>{destination.title}</strong>
              <small>{destination.description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
