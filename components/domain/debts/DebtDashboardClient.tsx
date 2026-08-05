"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DebtDashboardSummary, DebtLedgerPage, DebtPaymentLedgerEntry, DebtRequestItem, DebtRequestPage } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";
import DebtLedgerEntryCard from "@/components/domain/debts/DebtLedgerEntryCard";
import DebtRequestCard from "@/components/domain/debts/DebtRequestCard";

type ApiResult<T> = { data?: T; error?: string };

export default function DebtDashboardClient({ currentUserId }: { currentUserId: string }) {
  const [summary, setSummary] = useState<DebtDashboardSummary | null>(null);
  const [incoming, setIncoming] = useState<DebtPaymentLedgerEntry[]>([]);
  const [outgoing, setOutgoing] = useState<DebtPaymentLedgerEntry[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<DebtRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<DebtRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, incomingResponse, outgoingResponse, incomingRequestResponse, outgoingRequestResponse] = await Promise.all([
        fetch("/api/debts/summary"),
        fetch("/api/debts/payments?direction=incoming&status=pending&limit=50"),
        fetch("/api/debts/payments?direction=outgoing&status=pending&limit=50"),
        fetch("/api/debts/requests?direction=incoming&status=pending&limit=50"),
        fetch("/api/debts/requests?direction=outgoing&status=pending&limit=50"),
      ]);
      const [summaryJson, incomingJson, outgoingJson, incomingRequestJson, outgoingRequestJson] = await Promise.all([
        summaryResponse.json() as Promise<ApiResult<DebtDashboardSummary>>,
        incomingResponse.json() as Promise<ApiResult<DebtLedgerPage>>,
        outgoingResponse.json() as Promise<ApiResult<DebtLedgerPage>>,
        incomingRequestResponse.json() as Promise<ApiResult<DebtRequestPage>>,
        outgoingRequestResponse.json() as Promise<ApiResult<DebtRequestPage>>,
      ]);
      if (
        !summaryResponse.ok
        || !incomingResponse.ok
        || !outgoingResponse.ok
        || !incomingRequestResponse.ok
        || !outgoingRequestResponse.ok
        || !summaryJson.data
      ) {
        throw new Error(
          summaryJson.error
          ?? incomingJson.error
          ?? outgoingJson.error
          ?? incomingRequestJson.error
          ?? outgoingRequestJson.error
          ?? "Could not load DebtSync."
        );
      }
      setSummary(summaryJson.data);
      setIncoming((incomingJson.data?.entries ?? []).filter((item): item is DebtPaymentLedgerEntry => item.type === "payment"));
      setOutgoing((outgoingJson.data?.entries ?? []).filter((item): item is DebtPaymentLedgerEntry => item.type === "payment"));
      setIncomingRequests(incomingRequestJson.data?.requests ?? []);
      setOutgoingRequests(outgoingRequestJson.data?.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DebtSync.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="page-container debt-page">
      <div className="section-header">
        <div>
          <h1 className="debt-title">DebtSync</h1>
          <p className="text-secondary debt-subtitle">Track confirmed debts and payments between members.</p>
        </div>
        <div className="debt-command-grid"><Link href="/debts/requests/new" className="btn btn-secondary debt-full-mobile">Request debt</Link><Link href="/debts/payments/new" className="btn btn-primary debt-full-mobile">Record payment</Link></div>
      </div>

      {loading && <div className="debt-state"><span className="spinner" /> Loading balances…</div>}
      {error && <div className="debt-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div>}

      {summary && !loading && (
        <div className="debt-stack">
          <section className="debt-summary-grid" aria-label="Debt totals">
            <div className="stat-card"><span className="stat-label">You owe</span><span className="stat-value text-negative">{formatTaka(summary.youOwe)}</span><span className="stat-sub">Total you need to pay</span></div>
            <div className="stat-card"><span className="stat-label">Owed to you</span><span className="stat-value text-positive">{formatTaka(summary.owedToYou)}</span><span className="stat-sub">Total others need to pay</span></div>
            <div className="stat-card"><span className="stat-label">Net position</span><span className="stat-value">{formatTaka(summary.net)}</span><span className="stat-sub">Owed to you minus what you owe</span></div>
          </section>

          <section>
            <div className="debt-section-heading"><h2>Member positions</h2><Link href="/debts/ledger">Full ledger</Link></div>
            {summary.pairwise.length === 0 ? <div className="debt-empty">All member positions are settled.</div> : (
              <div className="debt-list">
                {summary.pairwise.map((position) => (
                  <div className="debt-position-row" key={position.memberId}>
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{position.memberName}</div><div className="text-secondary" style={{ fontSize: "0.8125rem" }}>{position.direction === "you_owe" ? "You owe this member" : position.direction === "owes_you" ? "This member owes you" : "Settled"}</div></div>
                    <strong className={position.direction === "you_owe" ? "text-negative" : position.direction === "owes_you" ? "text-positive" : "text-muted"}>{formatTaka(position.position)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <RequestSection title="Debt requests needing your response" count={summary.pendingDebtRequestIncomingCount} entries={incomingRequests} currentUserId={currentUserId} empty="No debt requests need your response." />
          <RequestSection title="Pending debt requests sent by you" count={summary.pendingDebtRequestOutgoingCount} entries={outgoingRequests} currentUserId={currentUserId} empty="You have no pending debt requests." />
          <PaymentSection title="Confirm incoming payments" count={summary.pendingIncomingCount} entries={incoming} empty="No payments need your confirmation." />
          <PaymentSection title="Pending outgoing payments" count={summary.pendingOutgoingCount} entries={outgoing} empty="No outgoing payments are waiting." />

          <section>
            <div className="debt-section-heading"><h2>Recent activity</h2><Link href="/debts/ledger">View all</Link></div>
            {summary.recentActivity.length === 0 ? <div className="debt-empty">No DebtSync activity yet.</div> : <div className="debt-list">{summary.recentActivity.map((entry) => <DebtLedgerEntryCard key={`${entry.type}-${entry.id}`} entry={entry} currentUserId={currentUserId} />)}</div>}
          </section>
        </div>
      )}
    </div>
  );
}

function PaymentSection({ title, count, entries, empty }: { title: string; count: number; entries: DebtPaymentLedgerEntry[]; empty: string }) {
  return <section><div className="debt-section-heading"><h2>{title}</h2><span className="badge badge-warning">{count}</span></div>{entries.length === 0 ? <div className="debt-empty">{empty}</div> : <div className="debt-list">{entries.map((entry) => <DebtLedgerEntryCard key={entry.id} entry={entry} />)}</div>}</section>;
}

function RequestSection({ title, count, entries, currentUserId, empty }: { title: string; count: number; entries: DebtRequestItem[]; currentUserId: string; empty: string }) {
  return <section><div className="debt-section-heading"><h2>{title}</h2><div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Link href="/debts/requests">View all</Link><span className="badge badge-warning">{count}</span></div></div>{entries.length === 0 ? <div className="debt-empty">{empty}</div> : <div className="debt-list">{entries.map((request) => <DebtRequestCard key={request.id} request={request} currentUserId={currentUserId} />)}</div>}</section>;
}
