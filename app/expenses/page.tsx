import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import HubCard from "@/components/navigation/HubCard";

export const metadata = {
  title: "Expenses",
  description: "Manage shared household expenses outside regular bazar trips.",
};

export default async function ExpensesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="page-container hub-page">
      <header className="hub-page__header">
        <h1>Expenses</h1>
        <p className="text-secondary">Manage longer-running and monthly household costs in one place.</p>
      </header>

      <div className="hub-grid">
        <HubCard href="/bulk-items" title="Bulk items" description="Track rice, gas, and other purchases across their full usage cycle." icon="bulk" />
        <HubCard href="/maid" title="Maid charges" description="Apply monthly charges and record who paid the household bill." icon="maid" />
        <HubCard href="/fridge" title="Fridge bill" description="Record meter readings, monthly allocations, and payments." icon="fridge" />
      </div>
    </div>
  );
}

