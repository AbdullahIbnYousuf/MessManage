"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import DebtLedgerEntryCard from "@/components/domain/debts/DebtLedgerEntryCard";
import { formatTaka } from "@/lib/utils/decimal";
import type { DebtMemberStatement } from "@/types/debts";

type ApiResult = { data?: DebtMemberStatement; error?: string };

export default function DebtMemberStatementClient({
  memberId,
  currentUserId,
}: {
  memberId: string;
  currentUserId: string;
}) {
  const [statement, setStatement] = useState<DebtMemberStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/debts/members/${memberId}/statement?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json() as ApiResult;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not load this member statement.");
      }
      const nextStatement = payload.data;
      setStatement((current) => cursor && current
        ? {
            ...nextStatement,
            history: [...current.history, ...nextStatement.history],
          }
        : nextStatement);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this member statement.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [memberId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="debt-state"><span className="spinner" /> Loading member statement…</div>;
  if (error && !statement) return <div className="debt-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div>;
  if (!statement) return null;

  const absolutePosition = new Decimal(statement.position).abs().toFixed(2);
  const direction = statement.direction === "you_owe" ? "sent" : statement.direction === "owes_you" ? "received" : null;
  const actionLabel = statement.direction === "you_owe" ? "Record money sent" : statement.direction === "owes_you" ? "Record money received" : "Record money";
  const actionParams = new URLSearchParams({ memberId: statement.member.id });
  if (direction) actionParams.set("direction", direction);
  const positionText = statement.direction === "you_owe"
    ? `You owe ${statement.member.name} ${formatTaka(absolutePosition)}.`
    : statement.direction === "owes_you"
      ? `${statement.member.name} owes you ${formatTaka(absolutePosition)}.`
      : `You and ${statement.member.name} are settled.`;

  return (
    <section className="debt-page debt-statement" aria-labelledby="member-statement-title">
      <div className="debt-back"><Link href="/money">← Debts &amp; payments</Link></div>
      <div className="section-header debt-statement-header">
        <div><span className="money-eyebrow">Member statement</span><h1 className="debt-title" id="member-statement-title">{statement.member.name}</h1><p className="text-secondary debt-subtitle">Every permanent obligation and money record between you.</p></div>
        {statement.member.status === "active" && <Link className="btn btn-primary debt-full-mobile" href={`/debts/payments/new?${actionParams.toString()}`}>{actionLabel}</Link>}
      </div>

      <div className={`debt-statement-position debt-statement-position--${statement.direction}`}>
        <span>Current confirmed position</span><strong>{positionText}</strong><small>Pending records are excluded until confirmed.</small>
      </div>

      <section className="debt-reconciliation" aria-labelledby="position-explanation-title">
        <div className="debt-section-heading debt-heading-with-note"><div><h2 id="position-explanation-title">Why this is your position</h2><p>Exact totals from permanent source records.</p></div></div>
        <div className="debt-reconciliation-grid">
          <div><span>Obligations you owed</span><strong>{formatTaka(statement.components.obligationsYouOwe)}</strong></div>
          <div><span>Obligations owed to you</span><strong>{formatTaka(statement.components.obligationsOwedToYou)}</strong></div>
          <div><span>Confirmed money sent</span><strong>{formatTaka(statement.components.moneyYouSent)}</strong></div>
          <div><span>Confirmed money received</span><strong>{formatTaka(statement.components.moneyYouReceived)}</strong></div>
        </div>
        <p className="debt-formula">Owed to you − you owed + money sent − money received = <strong>{formatTaka(statement.position)}</strong></p>
      </section>

      {(statement.member.bkashNumber || statement.member.bankAccountNumber) && (
        <section className="debt-payment-reference" aria-labelledby="payment-reference-title">
          <div className="debt-section-heading"><h2 id="payment-reference-title">Payment reference</h2></div>
          {statement.member.bkashNumber && <div><span>bKash</span><strong>{statement.member.bkashNumber}</strong></div>}
          {statement.member.bankAccountNumber && <div><span>{statement.member.bankName ?? "Bank"}</span><strong>{statement.member.bankAccountNumber}</strong></div>}
        </section>
      )}

      {statement.paymentsNeedingResponse.length > 0 && <StatementPaymentSection title="Your response is required" description="These records have no balance effect yet." entries={statement.paymentsNeedingResponse} currentUserId={currentUserId} />}
      {statement.paymentsInitiatedByMe.length > 0 && <StatementPaymentSection title="Waiting for confirmation" description={`Waiting for ${statement.member.name} to confirm or reject.`} entries={statement.paymentsInitiatedByMe} currentUserId={currentUserId} />}

      <section aria-labelledby="statement-history-title">
        <div className="debt-section-heading debt-heading-with-note"><div><h2 id="statement-history-title">Statement history</h2><p>Newest records first.</p></div></div>
        {statement.history.length === 0 ? <div className="debt-empty">No money history exists between you and this member.</div> : <div className="debt-list">{statement.history.map((entry) => <DebtLedgerEntryCard key={`${entry.type}-${entry.id}`} entry={entry} currentUserId={currentUserId} />)}</div>}
        {statement.nextCursor && <button className="btn btn-secondary debt-load-more" disabled={loadingMore} onClick={() => void load(statement.nextCursor ?? undefined)}>{loadingMore ? <><span className="spinner" /> Loading…</> : "Load older records"}</button>}
        {error && <div className="debt-error" role="alert">{error}</div>}
      </section>
    </section>
  );
}

function StatementPaymentSection({ title, description, entries, currentUserId }: { title: string; description: string; entries: DebtMemberStatement["paymentsNeedingResponse"]; currentUserId: string }) {
  return <section className="debt-attention-section"><div className="debt-section-heading debt-heading-with-note"><div><h2>{title}</h2><p>{description}</p></div><span className="badge badge-warning">{entries.length}</span></div><div className="debt-list">{entries.map((entry) => <DebtLedgerEntryCard key={entry.id} entry={entry} currentUserId={currentUserId} />)}</div></section>;
}
