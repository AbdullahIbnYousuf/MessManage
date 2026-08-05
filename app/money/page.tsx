import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import HubCard from "@/components/navigation/HubCard";

export const metadata = {
  title: "Money",
  description: "Understand monthly household balances and confirmed money between members.",
};

export default async function MoneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const debtSyncEnabled = process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED === "true";

  return (
    <div className="page-container hub-page">
      <header className="hub-page__header">
        <h1>Money</h1>
        <p className="text-secondary">See what is building up this month, close completed months, and track confirmed money between members.</p>
        <div className="money-lifecycle" aria-label="How household money moves through MessManage">
          <div className="money-lifecycle__step"><strong>1. Monthly activity</strong>Meals and shared expenses build a running balance.</div>
          <div className="money-lifecycle__step"><strong>2. Monthly closing</strong>The completed month becomes permanent obligations.</div>
          <div className="money-lifecycle__step"><strong>3. Confirmed balance</strong>Those obligations continue until money is confirmed.</div>
          <div className="money-lifecycle__step"><strong>4. Money record</strong>Both participants confirm money moved outside the app.</div>
        </div>
        <div className="money-lifecycle__note">Current-month and confirmed balances describe different stages. They are kept separate and are never added together on this page.</div>
      </header>

      <section className="hub-section">
        <div className="hub-section__heading">
          <h2>Current month</h2>
          <p className="text-secondary">Live household activity before the month is closed.</p>
        </div>
        <div className="hub-grid">
          <HubCard href={`/members/${user.id}`} title="My current balance" description="Review this month’s credits, costs, and running total." icon="money" />
          <HubCard href="/settlement" title="Monthly closing" description="Review household balances and view previously closed months." icon="closing" />
        </div>
      </section>

      {debtSyncEnabled && (
        <section className="hub-section">
          <div className="hub-section__heading">
            <h2>Confirmed money</h2>
            <p className="text-secondary">Long-running obligations and participant-confirmed money records.</p>
          </div>
          <div className="hub-grid">
            <HubCard href="/debts" title="Confirmed balances" description="See what you owe, what is owed to you, and each member position." icon="money" />
            <HubCard href="/debts/payments/new" title="Record money" description="Record money you sent or received for the other member to confirm." icon="record-money" />
            <HubCard href="/debts/ledger" title="Ledger" description="Review permanent obligations and confirmed payment activity." icon="ledger" />
          </div>
        </section>
      )}
    </div>
  );
}
