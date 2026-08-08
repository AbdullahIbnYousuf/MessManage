"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  closingPresentation,
  currentBalanceLabel,
} from "@/components/domain/money/presentation";
import { formatMonthLabel, formatTimestamp } from "@/lib/utils/dates";
import { formatTaka } from "@/lib/utils/decimal";
import type { HouseholdMoneySummary } from "@/types/money";

function MoneySkeleton() {
  return (
    <div className="money-overview-skeleton" aria-label="Loading monthly balance">
      <div className="money-current-card"><span className="skeleton" style={{ width: 120, height: 14 }} /><span className="skeleton" style={{ width: 190, height: 40 }} /><span className="skeleton" style={{ width: "100%", height: 76 }} /></div>
      <div className="money-closing-card"><span className="skeleton" style={{ width: 110, height: 14 }} /><span className="skeleton" style={{ width: "70%", height: 24 }} /><span className="skeleton" style={{ width: "100%", height: 44 }} /></div>
    </div>
  );
}

function MoneyStatus({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "neutral" | "attention" | "danger";
}) {
  return <span className={`money-status money-status--${tone}`}>{label}</span>;
}

export default function MoneyOverviewClient({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [summary, setSummary] = useState<HouseholdMoneySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/money/household-summary", { cache: "no-store" });
      const payload = await response.json() as { data?: HouseholdMoneySummary; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not load the monthly balance.");
      }
      setSummary(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the monthly balance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const closing = summary
    ? closingPresentation(summary.previousClosing.status, isAdmin, summary.previousClosing.issues.length)
    : null;

  return (
    <section className="hub-page money-page" aria-labelledby="household-money-title">
      <header className="hub-page__header money-page__header">
        <div>
          <h1 id="household-money-title">Household monthly balance</h1>
          <p className="text-secondary">Meals and shared household activity before monthly closing.</p>
        </div>
      </header>

      <div className="money-lifecycle money-lifecycle--compact" aria-label="Household money lifecycle">
        <div className="money-lifecycle__step"><strong>1 · Monthly activity</strong>Provisional meals, contributions, and shared costs.</div>
        <div className="money-lifecycle__step"><strong>2 · Monthly closing</strong>Freezes the month into permanent member obligations.</div>
      </div>
      <p className="money-separation-note">This provisional balance is never added to your confirmed debt position.</p>

      {error && <div className="money-error" role="alert"><div><strong>Monthly balance unavailable</strong><span>{error}</span></div><button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div>}

      {loading ? <MoneySkeleton /> : summary && closing && (
        <>
          <div className="money-stage-grid">
            <section className="money-current-card">
              <div className="money-card-heading">
                <div><span className="money-eyebrow">This month · {formatMonthLabel(summary.currentMonth.month)}</span><h2>{currentBalanceLabel(summary.currentMonth.direction)}</h2></div>
                <MoneyStatus label="Provisional" tone="neutral" />
              </div>
              <div className={`money-current-amount money-current-amount--${summary.currentMonth.direction}`}>{formatTaka(summary.currentMonth.balance)}</div>
              <div className="money-stat-pair">
                <div><span>Credits</span><strong>{formatTaka(summary.currentMonth.credits)}</strong></div>
                <div><span>Costs</span><strong>{formatTaka(summary.currentMonth.costs)}</strong></div>
              </div>
              <div className="money-context-row"><span>{summary.currentMonth.totalMeals} personal meals</span><span>{summary.currentMonth.householdMeals} household meals</span><span>Meal rate {summary.currentMonth.mealRate ? formatTaka(summary.currentMonth.mealRate) : "Not available"}</span></div>
              {!summary.currentMonth.hasData && <p className="money-empty-note">No current-month financial activity has been recorded yet.</p>}
              <Link href={`/members/${currentUserId}`} className="btn btn-secondary money-card-action">Open my complete breakdown <span aria-hidden="true">→</span></Link>
            </section>

            <section className="money-closing-card">
              <div className="money-card-heading">
                <div><span className="money-eyebrow">{formatMonthLabel(summary.previousClosing.month)}</span><h2>{closing.title}</h2></div>
                <MoneyStatus label={closing.label} tone={closing.tone} />
              </div>
              <p>{closing.description}</p>
              {summary.previousClosing.settledAt && <div className="money-closed-date">Closed {formatTimestamp(summary.previousClosing.settledAt)}</div>}
              {summary.previousClosing.issues.length > 0 && <div className="money-issue-preview"><strong>{summary.previousClosing.issues[0]}</strong>{summary.previousClosing.issues.length > 1 && <span>+{summary.previousClosing.issues.length - 1} more</span>}</div>}
              <Link href={`/settlement?month=${summary.previousClosing.month}`} className="btn btn-secondary money-card-action">Open monthly closing <span aria-hidden="true">→</span></Link>
              <Link href="/settlement" className="money-text-link">View closed months →</Link>
            </section>
          </div>

          <section className="money-breakdown-card" aria-labelledby="monthly-breakdown-title">
            <div className="money-section-heading"><div><h2 id="monthly-breakdown-title">This month’s breakdown</h2><p>Exact source totals used to derive your provisional position.</p></div></div>
            <div className="money-breakdown-grid">
              <div><span>Bazar contributed</span><strong className="text-positive">{formatTaka(summary.currentMonth.breakdown.bazarContributed)}</strong></div>
              <div><span>Maid payments</span><strong className="text-positive">{formatTaka(summary.currentMonth.breakdown.maidPayments)}</strong></div>
              <div><span>Fridge payments</span><strong className="text-positive">{formatTaka(summary.currentMonth.breakdown.fridgePayments)}</strong></div>
              <div><span>Bulk purchases</span><strong className="text-positive">{formatTaka(summary.currentMonth.breakdown.bulkPurchases)}</strong></div>
              <div><span>Meal cost</span><strong className="text-negative">{formatTaka(summary.currentMonth.breakdown.mealCost)}</strong></div>
              <div><span>Maid charge</span><strong className="text-negative">{formatTaka(summary.currentMonth.breakdown.maidCharge)}</strong></div>
              <div><span>Fridge share</span><strong className="text-negative">{formatTaka(summary.currentMonth.breakdown.fridgeBillShare)}</strong></div>
              <div><span>Bulk allocations</span><strong className="text-negative">{formatTaka(summary.currentMonth.breakdown.bulkAllocations)}</strong></div>
            </div>
            <div className="money-household-context"><span>Household bazar this month</span><strong>{formatTaka(summary.currentMonth.householdBazar)}</strong></div>
          </section>
        </>
      )}
    </section>
  );
}
