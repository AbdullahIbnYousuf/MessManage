"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NavIcon from "@/components/navigation/NavIcon";
import ExpenseSummaryCard from "@/components/domain/expenses/ExpenseSummaryCard";
import { buildExpenseReviewItems } from "@/components/domain/expenses/presentation";
import { formatMonthLabel } from "@/lib/utils/dates";
import { formatTaka } from "@/lib/utils/decimal";
import type { ExpensesSummary } from "@/types/expenses";

function ExpensesSkeleton() {
  return (
    <div className="expenses-overview-grid" aria-label="Loading expense summary">
      {["bulk", "maid", "fridge"].map((key) => (
        <div className="expense-summary-card" key={key}>
          <div className="expense-skeleton-row">
            <span className="skeleton" style={{ width: 42, height: 42 }} />
            <span className="skeleton" style={{ width: "45%", height: 18 }} />
          </div>
          <span className="skeleton" style={{ width: "100%", height: 72 }} />
          <span className="skeleton" style={{ width: "100%", height: 44 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="expense-empty-message">{children}</p>;
}

export default function ExpensesOverviewClient({ isAdmin }: { isAdmin: boolean }) {
  const [summary, setSummary] = useState<ExpensesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/expenses/summary", { cache: "no-store" });
      const payload = await response.json() as { data?: ExpensesSummary; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not load the expense summary.");
      }
      setSummary(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the expense summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewItems = summary ? buildExpenseReviewItems(summary, isAdmin) : [];
  const maidStatus = summary?.maid.status === "applied"
    ? { label: "Applied", tone: "success" as const }
    : summary?.maid.status === "settled_zero"
      ? { label: "Closed at zero", tone: "neutral" as const }
      : { label: "Not applied", tone: "neutral" as const };
  const fridgeStatus = summary?.fridge.status === "posted"
    ? { label: "Posted", tone: "success" as const }
    : summary?.fridge.status === "settled"
      ? { label: "Closed", tone: "neutral" as const }
      : { label: "Not posted", tone: "neutral" as const };

  return (
    <div className="page-container hub-page expenses-page">
      <header className="hub-page__header">
        <h1>Expenses</h1>
        <p className="text-secondary">
          See the household’s longer-running and monthly costs at a glance.
        </p>
      </header>

      {summary && (
        <div className="expense-context" aria-label="Expense reporting periods">
          <div><span>Bulk</span><strong>Active cycles</strong></div>
          <div><span>Maid</span><strong>{formatMonthLabel(summary.currentMonth)}</strong></div>
          <div><span>Fridge</span><strong>{formatMonthLabel(summary.previousMonth)}</strong></div>
        </div>
      )}

      {error && (
        <div className="expense-error" role="alert">
          <div>
            <strong>Expense summary unavailable</strong>
            <span>{error}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {loading ? <ExpensesSkeleton /> : summary && (
        <>
          {reviewItems.length > 0 && (
            <section className="hub-section expense-review">
              <div className="hub-section__heading">
                <h2>To review</h2>
                <p className="text-secondary">These are status reminders, not overdue warnings.</p>
              </div>
              <div className="expense-review__list">
                {reviewItems.map((item) => (
                  <Link href={item.href} className="expense-review__item" key={item.id}>
                    <span className="expense-review__icon"><NavIcon name={item.icon} size={18} /></span>
                    <span className="expense-review__copy">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="expenses-overview-grid">
            <ExpenseSummaryCard
              title="Bulk items"
              icon="bulk"
              status={summary.bulk.itemCount === 0
                ? "Not set up"
                : summary.bulk.missingCycleCount > 0
                  ? `${summary.bulk.missingCycleCount} inactive`
                  : "Cycles active"}
              tone={summary.bulk.activeCycleCount > 0 ? "success" : "neutral"}
              href="/bulk-items"
              actionLabel="Open bulk items"
            >
              <div className="expense-primary-stat">
                <strong>{summary.bulk.activeCycleCount}</strong>
                <span>active {summary.bulk.activeCycleCount === 1 ? "cycle" : "cycles"}</span>
              </div>
              {summary.bulk.activeCycles.length > 0 ? (
                <div className="expense-cycle-list">
                  {summary.bulk.activeCycles.map((cycle) => (
                    <div className="expense-cycle-row" key={cycle.cycleId}>
                      <div>
                        <strong>{cycle.itemName}</strong>
                        <span>Bought by {cycle.purchasedBy.name}</span>
                      </div>
                      <div>
                        <strong>{formatTaka(cycle.cost)}</strong>
                        <span>{cycle.daysActive} {cycle.daysActive === 1 ? "day" : "days"} active</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyMessage>No active consumption cycles yet.</EmptyMessage>
              )}
            </ExpenseSummaryCard>

            <ExpenseSummaryCard
              title="Maid charges"
              icon="maid"
              status={maidStatus.label}
              tone={maidStatus.tone}
              href="/maid"
              actionLabel="Open maid charges"
            >
              <div className="expense-stat-pair">
                <div><span>Charges</span><strong>{formatTaka(summary.maid.chargeTotal)}</strong><small>{summary.maid.chargeCount} records</small></div>
                <div><span>Payments</span><strong>{formatTaka(summary.maid.paymentTotal)}</strong><small>{summary.maid.paymentCount} records</small></div>
              </div>
              {summary.maid.status === "not_applied" && (
                <EmptyMessage>
                  {isAdmin
                    ? `Optional: apply the ${formatTaka(summary.maid.defaultCharge)} default charge.`
                    : "No charges have been applied for this month."}
                </EmptyMessage>
              )}
              {summary.maid.status === "settled_zero" && (
                <EmptyMessage>This month was closed without maid charges.</EmptyMessage>
              )}
            </ExpenseSummaryCard>

            <ExpenseSummaryCard
              title="Fridge bill"
              icon="fridge"
              status={fridgeStatus.label}
              tone={fridgeStatus.tone}
              href="/fridge"
              actionLabel="Open fridge bill"
            >
              {summary.fridge.billId ? (
                <>
                  <div className="expense-stat-pair">
                    <div><span>Bill total</span><strong>{formatTaka(summary.fridge.totalAmount)}</strong><small>{summary.fridge.memberCount ?? 0} members</small></div>
                    <div><span>Payments</span><strong>{formatTaka(summary.fridge.paymentTotal)}</strong><small>{summary.fridge.paymentCount} records</small></div>
                  </div>
                  <div className="expense-meter-row">
                    <span>Meter use</span>
                    <strong>{summary.fridge.unitsUsed ?? "0.00"} units</strong>
                  </div>
                </>
              ) : (
                <EmptyMessage>
                  {summary.fridge.status === "settled"
                    ? "This month was closed without a fridge bill."
                    : "No fridge bill has been posted for this billing month."}
                </EmptyMessage>
              )}
            </ExpenseSummaryCard>
          </div>
        </>
      )}
    </div>
  );
}
