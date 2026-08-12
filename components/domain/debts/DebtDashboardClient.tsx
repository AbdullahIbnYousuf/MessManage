"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DebtDashboardSummary, DebtPaymentLedgerEntry } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";
import DebtLedgerEntryCard from "@/components/domain/debts/DebtLedgerEntryCard";
import { PageHeader } from "@/components/ui/Editorial";

type ApiResult<T> = { data?: T; error?: string };

export default function DebtDashboardClient({ currentUserId }: { currentUserId: string }) {
  const [summary, setSummary] = useState<DebtDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/debts/summary", { cache: "no-store" });
      const json = await response.json() as ApiResult<DebtDashboardSummary>;
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Could not load debts and payments.");
      }
      setSummary(json.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load debts and payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="debt-page money-command-center" aria-labelledby="money-debts-title">
      <PageHeader
        eyebrow="Confirmed member money"
        title={<span id="money-debts-title">Debts &amp; payments</span>}
        description="Permanent household obligations and confirmed money between members."
        actions={<div className="debt-command-grid">
          <Link href="/debts/payments/new" className="btn btn-primary debt-full-mobile">Record money</Link>
          <Link href="/debts/ledger" className="btn btn-secondary debt-full-mobile">Open ledger</Link>
        </div>}
      />

      {loading && <div className="debt-state"><span className="spinner" /> Loading confirmed positions…</div>}
      {error && <div className="debt-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div>}

      {summary && !loading && (
        <div className="debt-stack">
          {summary.paymentsNeedingResponse.length > 0 && (
            <PaymentSection
              title="Response required"
              description="These records have no balance effect until you confirm or reject them."
              count={summary.pendingPaymentResponseCount}
              entries={summary.paymentsNeedingResponse}
              currentUserId={currentUserId}
            />
          )}

          <section aria-labelledby="confirmed-position-title">
            <div className="debt-section-heading debt-heading-with-note">
              <div><h2 id="confirmed-position-title">Confirmed position</h2><p>Pending records are excluded.</p></div>
            </div>
            <div className="debt-summary-grid debt-summary-grid--command">
              <div className="stat-card"><span className="stat-label">You owe</span><span className="stat-value text-negative">{formatTaka(summary.youOwe)}</span><span className="stat-sub">Total you need to pay</span></div>
              <div className="stat-card"><span className="stat-label">Owed to you</span><span className="stat-value text-positive">{formatTaka(summary.owedToYou)}</span><span className="stat-sub">Total others need to pay</span></div>
            </div>
            <div className="debt-net-position"><span>Net position</span><strong>{formatTaka(summary.net)}</strong><small>Owed to you minus what you owe</small></div>
          </section>

          <section aria-labelledby="member-positions-title">
            <div className="debt-section-heading"><h2 id="member-positions-title">Member positions</h2><Link href="/debts/ledger">Full ledger</Link></div>
            {summary.pairwise.length === 0 ? (
              <div className="debt-zero-state"><strong>All confirmed positions are settled</strong><span>You can still record money that moved outside the app or review the complete ledger.</span><div><Link href="/debts/payments/new" className="btn btn-primary">Record money</Link><Link href="/debts/ledger" className="btn btn-secondary">Open ledger</Link></div></div>
            ) : (
              <div className="debt-list">
                {summary.pairwise.map((position) => (
                  <Link className="debt-position-row debt-position-link" href={`/money/members/${position.memberId}`} key={position.memberId}>
                    <div className="debt-position-person"><strong>{position.memberName}</strong><span>{position.direction === "you_owe" ? "You owe this member" : position.direction === "owes_you" ? "This member owes you" : "A payment is pending"}</span></div>
                    <span className="debt-position-amount"><strong className={position.direction === "you_owe" ? "text-negative" : position.direction === "owes_you" ? "text-positive" : "text-muted"}>{formatTaka(position.position)}</strong><span aria-hidden="true">→</span></span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {summary.paymentsInitiatedByMe.length > 0 && (
            <PaymentSection
              title="Waiting for confirmation"
              description="These records were started by you and do not affect balances yet."
              count={summary.pendingPaymentInitiatedCount}
              entries={summary.paymentsInitiatedByMe}
              currentUserId={currentUserId}
            />
          )}

          <section>
            <div className="debt-section-heading"><h2>Recent confirmed activity</h2><Link href="/debts/ledger">View all</Link></div>
            {summary.recentActivity.length === 0 ? <div className="debt-empty">No confirmed money activity yet.</div> : <div className="debt-list">{summary.recentActivity.map((entry) => <DebtLedgerEntryCard key={`${entry.type}-${entry.id}`} entry={entry} currentUserId={currentUserId} />)}</div>}
          </section>
        </div>
      )}
    </section>
  );
}

function PaymentSection({
  title,
  description,
  count,
  entries,
  currentUserId,
}: {
  title: string;
  description: string;
  count: number;
  entries: DebtPaymentLedgerEntry[];
  currentUserId: string;
}) {
  return (
    <section className="debt-attention-section">
      <div className="debt-section-heading debt-heading-with-note"><div><h2>{title}</h2><p>{description}</p></div><span className="badge badge-warning">{count}</span></div>
      <div className="debt-list">{entries.map((entry) => <DebtLedgerEntryCard key={entry.id} entry={entry} currentUserId={currentUserId} />)}</div>
    </section>
  );
}
