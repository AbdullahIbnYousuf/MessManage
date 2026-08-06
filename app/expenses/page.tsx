import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import ExpensesOverviewClient from "@/components/domain/expenses/ExpensesOverviewClient";

export const metadata = {
  title: "Expenses",
  description: "Manage shared household expenses outside regular bazar trips.",
};

export default async function ExpensesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  return <ExpensesOverviewClient isAdmin={user.role === "admin"} />;
}
