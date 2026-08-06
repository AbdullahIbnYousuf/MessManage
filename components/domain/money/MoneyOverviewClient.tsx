"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DebtLedgerEntryCard from "@/components/domain/debts/DebtLedgerEntryCard";
import {
  closingPresentation,
  currentBalanceLabel,
} from "@/components/domain/money/presentation";
import { formatMonthLabel, formatTimestamp } from "@/lib/utils/dates";
import { formatTaka } from "@/lib/utils/decimal";
import type { MoneySummary } from "@/types/money";

function MoneySkeleton() {
  return (
    <div className="money-overview-skeleton" aria-label="Loading money overview">
      <div className="money-current-card">
        <span className="skeleton" style={{ width: 120, height: 14 }} />
        <span className="skeleton" style={{ width: 190, height: 40 }} />
        <span className="skeleton" style={{ width: "100%", height: 76 }} />
      </div>
      <div className="money-closing-card">
        <span className="skeleton" style={{ width: 110, height: 14 }} />
        <span className="skeleton" style={{ width: "70%", height: 24 }} />
        <span className="skeleton" style={{ width: "100%", height: 44 }} />
      </div>
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
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/money/summary", { cache: "no-store" });
      const payload = await response.json() as { data?: MoneySummary; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not load the money overview.");
      }
      setSummary(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the money overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closing = summary
    ? closingPresentation(
        summary.previousClosing.status,
        isAdmin,
        summary.previousClosing.issues.length
      )
    : null;

  return (
    <div className="page-container hub-page money-page">
      <header className="hub-page__header money-page__header">
        <div>
          <h1>Money</h1>
          <p className="text-secondary">
            Follow this month’s household balance through closing and confirmed payment.
          </p>
        </div>
        {summary?.confirmedMoneyEnabled && (
          <Link href="/debts/payments/new" className="btn btn-primary money-primary-action">
            Record money
          </Link>
        )}
      </header>

      <div className="money-stage-guide" aria-label="Money stages">
        <div>
          <span>1</span>
          <div><strong>Current month</strong><small>Provisional household activity</small></div>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span>2</span>
          <div><strong>Confirmed money</strong><small>Permanent after monthly closing</small></div>
        </div>
      </div>
      <p className="money-separation-note">
        These stages are kept separate. Their balances are never added together.
      </p>

      {error && (
        <div className="money-error" role="alert">
          <div><strong>Money overview unavailable</strong><span>{error}</span></div>
          <button className="btn btn-secondary" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {loading ? <MoneySkeleton /> : summary && closing && (
        <>
          <div className="money-stage-grid">
            <section className="money-current-card">
              <div className="money-card-heading">
                <div>
                  <span className="money-eyebrow">This month · {formatMonthLabel(summary.currentMonth.month)}</span>
                  <h2>{currentBalanceLabel(summary.currentMonth.direction)}</h2>
                </div>
                <MoneyStatus label="Provisional" tone="neutral" />
              </div>
              <div className={`money-current-amount money-current-amount--${summary.currentMonth.direction}`}>
                {formatTaka(summary.currentMonth.balance)}
              </div>
              <div className="money-stat-pair">
                <div><span>Credits</span><strong>{formatTaka(summary.currentMonth.credits)}</strong></div>
                <div><span>Costs</span><strong>{formatTaka(summary.currentMonth.costs)}</strong></div>
              </div>
              <div className="money-context-row">
                <span>{summary.currentMonth.totalMeals} meals</span>
                <span>Meal rate {summary.currentMonth.mealRate ? formatTaka(summary.currentMonth.mealRate) : "Not available"}</span>
              </div>
              {!summary.currentMonth.hasData && (
                <p className="money-empty-note">No current-month financial activity has been recorded yet.</p>
              )}
              <Link href={`/members/${currentUserId}`} className="btn btn-secondary money-card-action">
                Open my balance breakdown <span aria-hidden="true">→</span>
              </Link>
            </section>

            <section className="money-closing-card">
              <div className="money-card-heading">
                <div>
                  <span className="money-eyebrow">{formatMonthLabel(summary.previousClosing.month)}</span>
                  <h2>{closing.title}</h2>
                </div>
                <MoneyStatus label={closing.label} tone={closing.tone} />
              </div>
              <p>{closing.description}</p>
              {summary.previousClosing.settledAt && (
                <div className="money-closed-date">Closed {formatTimestamp(summary.previousClosing.settledAt)}</div>
              )}
              {summary.previousClosing.issues.length > 0 && (
                <div className="money-issue-preview">
                  <strong>{summary.previousClosing.issues[0]}</strong>
                  {summary.previousClosing.issues.length > 1 && (
                    <span>+{summary.previousClosing.issues.length - 1} more</span>
                  )}
                </div>
              )}
              <Link
                href={`/settlement?month=${summary.previousClosing.month}`}
                className="btn btn-secondary money-card-action"
              >
                Open monthly closing <span aria-hidden="true">→</span>
              </Link>
            </section>
          </div>

          {summary.confirmedMoneyEnabled && summary.confirmedMoney && (
            <section className="money-confirmed-section">
              <div className="money-section-heading">
                <div>
                  <h2>Confirmed money</h2>
                  <p>Permanent obligations and payment records confirmed between members.</p>
                </div>
                <Link href="/debts" className="money-text-link">Balances &amp; Payments →</Link>
              </div>

              {summary.confirmedMoney.pendingResponseCount > 0 && (
                <div className="money-response-block">
                  <div className="money-response-heading">
                    <div><h3>Needs your response</h3><p>Open a record to confirm or reject it.</p></div>
                    <span className="badge badge-warning">{summary.confirmedMoney.pendingResponseCount}</span>
                  </div>
                  <div className="debt-list">
                    {summary.confirmedMoney.pendingResponses.map((entry) => (
                      <DebtLedgerEntryCard key={entry.id} entry={entry} currentUserId={currentUserId} />
                    ))}
                  </div>
                </div>
              )}

              {summary.confirmedMoney.pendingInitiatedCount > 0 && (
                <Link href="/debts" className="money-pending-started">
                  <span>{summary.confirmedMoney.pendingInitiatedCount} pending {summary.confirmedMoney.pendingInitiatedCount === 1 ? "record" : "records"} started by you</span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}

              <div className="money-confirmed-totals">
                <div><span>You owe</span><strong className="text-negative">{formatTaka(summary.confirmedMoney.youOwe)}</strong></div>
                <div><span>Owed to you</span><strong className="text-positive">{formatTaka(summary.confirmedMoney.owedToYou)}</strong></div>
                <div><span>Net position</span><strong>{formatTaka(summary.confirmedMoney.net)}</strong></div>
              </div>

              <div className="money-confirmed-grid">
                <section className="money-list-card">
                  <div className="money-list-card__heading"><h3>Member positions</h3><span>{summary.confirmedMoney.pairwiseCount}</span></div>
                  {summary.confirmedMoney.pairwise.length > 0 ? (
                    <div className="money-position-list">
                      {summary.confirmedMoney.pairwise.map((position) => (
                        <div key={position.memberId}>
                          <span><strong>{position.memberName}</strong><small>{position.direction === "you_owe" ? "You owe" : "Owes you"}</small></span>
                          <strong className={position.direction === "you_owe" ? "text-negative" : "text-positive"}>{formatTaka(position.position)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : <p className="money-empty-note">All member positions are settled.</p>}
                  <Link href="/debts" className="money-text-link">View all positions →</Link>
                </section>

                <section className="money-list-card">
                  <div className="money-list-card__heading"><h3>Recent activity</h3></div>
                  {summary.confirmedMoney.recentActivity.length > 0 ? (
                    <div className="debt-list">
                      {summary.confirmedMoney.recentActivity.map((entry) => (
                        <DebtLedgerEntryCard key={`${entry.type}-${entry.id}`} entry={entry} currentUserId={currentUserId} />
                      ))}
                    </div>
                  ) : <p className="money-empty-note">No confirmed money activity yet.</p>}
                  <Link href="/debts/ledger" className="money-text-link">Open full ledger →</Link>
                </section>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
