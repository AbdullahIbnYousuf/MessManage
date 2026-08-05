import type { SessionUser } from "@/types";

export type NavigationId =
  | "home"
  | "meals"
  | "bazar"
  | "expenses"
  | "money"
  | "members"
  | "admin";

export type NavigationIconName =
  | "home"
  | "meals"
  | "bazar"
  | "expenses"
  | "money"
  | "members"
  | "admin"
  | "profile"
  | "notifications"
  | "bulk"
  | "maid"
  | "fridge"
  | "closing"
  | "ledger"
  | "record-money";

export type NavigationFeature = "always" | "debtsync";
export type NavigationRole = SessionUser["role"] | "all";
export type NavigationSection = "main" | "household" | "admin";
export type MobilePlacement = "bottom" | "more" | "none";

export interface NavigationItem {
  id: NavigationId;
  href: string;
  label: string;
  icon: NavigationIconName;
  section: NavigationSection;
  activePrefixes: readonly string[];
  role: NavigationRole;
  feature: NavigationFeature;
  mobile: MobilePlacement;
}

export const navigationItems: readonly NavigationItem[] = [
  {
    id: "home",
    href: "/dashboard",
    label: "Home",
    icon: "home",
    section: "main",
    activePrefixes: ["/dashboard"],
    role: "all",
    feature: "always",
    mobile: "bottom",
  },
  {
    id: "meals",
    href: "/meals",
    label: "Meals",
    icon: "meals",
    section: "main",
    activePrefixes: ["/meals"],
    role: "all",
    feature: "always",
    mobile: "bottom",
  },
  {
    id: "bazar",
    href: "/bazar",
    label: "Bazar",
    icon: "bazar",
    section: "main",
    activePrefixes: ["/bazar"],
    role: "all",
    feature: "always",
    mobile: "bottom",
  },
  {
    id: "expenses",
    href: "/expenses",
    label: "Expenses",
    icon: "expenses",
    section: "household",
    activePrefixes: ["/expenses", "/bulk-items", "/maid", "/fridge"],
    role: "all",
    feature: "always",
    mobile: "more",
  },
  {
    id: "money",
    href: "/money",
    label: "Money",
    icon: "money",
    section: "household",
    activePrefixes: ["/money", "/debts", "/settlement"],
    role: "all",
    feature: "always",
    mobile: "bottom",
  },
  {
    id: "members",
    href: "/members",
    label: "Members",
    icon: "members",
    section: "household",
    activePrefixes: ["/members"],
    role: "all",
    feature: "always",
    mobile: "more",
  },
  {
    id: "admin",
    href: "/admin",
    label: "Admin Panel",
    icon: "admin",
    section: "admin",
    activePrefixes: ["/admin"],
    role: "admin",
    feature: "always",
    mobile: "more",
  },
] as const;

export const navigationSections: readonly {
  id: NavigationSection;
  label: string;
}[] = [
  { id: "main", label: "Main" },
  { id: "household", label: "Household" },
  { id: "admin", label: "Admin" },
];

export function navigationVisibleTo(
  item: NavigationItem,
  role: SessionUser["role"],
  debtSyncEnabled: boolean
): boolean {
  const roleVisible = item.role === "all" || item.role === role;
  const featureVisible = item.feature === "always" || debtSyncEnabled;
  return roleVisible && featureVisible;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function activeNavigationId(
  pathname: string,
  currentUserId: string
): NavigationId | null {
  if (matchesPrefix(pathname, `/members/${currentUserId}`)) return "money";
  if (matchesPrefix(pathname, "/members")) return "members";

  return navigationItems.find((item) =>
    item.activePrefixes.some((prefix) => matchesPrefix(pathname, prefix))
  )?.id ?? null;
}

