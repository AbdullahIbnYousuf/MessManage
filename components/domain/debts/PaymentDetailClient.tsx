"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DebtPaymentDetail } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";
import { DebtStatusBadge } from "@/components/domain/debts/DebtLedgerEntryCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/Editorial";

type ConfirmAction = "accept" | "cancel" | "reverse";

export default function PaymentDetailClient({ paymentId, currentUserId }: { paymentId: string; currentUserId: string }) {
  const [payment, setPayment] = useState<DebtPaymentDetail | null>(null);
  const [returnRequestId, setReturnRequestId] = useState("");
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => { setReturnRequestId(crypto.randomUUID()); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/debts/payments/${paymentId}`);
      const json = await response.json() as { data?: DebtPaymentDetail; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not load payment.");
      setPayment(json.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load payment.");
    } finally { setLoading(false); }
  }, [paymentId]);
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: string, body?: Record<string, string>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(path, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json() as { error?: string; code?: string; currentStatus?: string };
      if (!response.ok) {
        if (response.status === 409) {
          await load();
          throw new Error(`${json.error ?? "Payment changed."}${json.currentStatus ? ` Current status: ${json.currentStatus}.` : ""}`);
        }
        throw new Error(json.error ?? "Payment could not be updated.");
      }
      setReason(""); setShowReject(false); await load();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Payment could not be updated.");
    } finally { setBusy(false); }
  }

  if (loading && !payment) return <div className="page-container debt-state"><span className="spinner" /> Loading payment…</div>;
  if (!payment) return <div className="page-container debt-page"><div className="debt-error">{error ?? "Payment not found."}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div></div>;

  const isSender = payment.sender.id === currentUserId;
  const isReceiver = payment.receiver.id === currentUserId;
  const receiverInitiated = payment.initiatedBy === "receiver";
  const isInitiator = receiverInitiated ? isReceiver : isSender;
  const isConfirmer = receiverInitiated ? isSender : isReceiver;
  const created = formatDate(payment.createdAt);
  const confirmCopy = confirmAction === "accept"
    ? {
        title: receiverInitiated
          ? `Confirm that you sent ${formatTaka(payment.amount)} to ${payment.receiver.name}?`
          : `Accept this ${formatTaka(payment.amount)} payment?`,
        description: "The confirmed record will immediately affect both members’ balances.",
        label: receiverInitiated ? "Confirm money sent" : "Accept payment",
        tone: "primary" as const,
      }
    : confirmAction === "cancel"
      ? {
          title: "Cancel this pending payment record?",
          description: "The record will remain in history and will have no balance effect.",
          label: "Cancel record",
          tone: "danger" as const,
        }
      : {
          title: `Create a return payment for ${formatTaka(payment.amount)}?`,
          description: "The original sender must confirm the return before balances change.",
          label: "Create return payment",
          tone: "primary" as const,
        };

  function confirmSelectedAction() {
    const selected = confirmAction;
    setConfirmAction(null);
    if (!payment) return;
    if (selected === "accept") void mutate(`/api/debts/payments/${payment.id}/respond`, { decision: "accept" });
    if (selected === "cancel") void mutate(`/api/debts/payments/${payment.id}/cancel`);
    if (selected === "reverse") void mutate(`/api/debts/payments/${payment.id}/reverse`, { clientRequestId: returnRequestId });
  }

  return (
    <div className="page-container debt-page">
      <div className="debt-back"><Link href="/money">← Debts &amp; payments</Link></div>
      <PageHeader eyebrow="Confirmed member money" title="Payment details" description={payment.source === "reversal" ? "Return payment" : receiverInitiated ? "Money received record" : "Direct payment"} actions={<DebtStatusBadge status={payment.status} />} />
      <div className="card debt-detail">
        <div className="debt-detail-amount">{formatTaka(payment.amount)}</div>
        <p className="debt-direction">{receiverInitiated ? `${payment.receiver.name} recorded receiving money from ${payment.sender.name}.` : `${payment.sender.name} recorded a payment to ${payment.receiver.name}.`}</p>
        <dl className="debt-detail-list">
          <div><dt>From</dt><dd>{payment.sender.name}{isSender ? " (you)" : ""}</dd></div>
          <div><dt>To</dt><dd>{payment.receiver.name}{isReceiver ? " (you)" : ""}</dd></div>
          <div><dt>Recorded</dt><dd>{created}</dd></div>
          <div><dt>Started by</dt><dd>{receiverInitiated ? payment.receiver.name : payment.sender.name}{isInitiator ? " (you)" : ""}</dd></div>
          {payment.respondedAt && <div><dt>Responded</dt><dd>{formatDate(payment.respondedAt)}</dd></div>}
          {payment.cancelledAt && <div><dt>Cancelled</dt><dd>{formatDate(payment.cancelledAt)}</dd></div>}
          {payment.description && <div><dt>Description</dt><dd>{payment.description}</dd></div>}
          {payment.rejectionReason && <div><dt>Rejection reason</dt><dd>{payment.rejectionReason}</dd></div>}
        </dl>
        {payment.reversesTransferId && <Link className="debt-related-link" href={`/debts/payments/${payment.reversesTransferId}`}>View original payment →</Link>}
        {payment.reversedPaymentIds.map((id, index) => <Link className="debt-related-link" href={`/debts/payments/${id}`} key={id}>View return payment {index + 1} →</Link>)}
      </div>

      <div className="debt-note">MessManage records member confirmation; it does not transfer money through the app.</div>
      {error && <div className="debt-error" role="alert">{error}</div>}

      {payment.status === "pending" && isConfirmer && <div className="card debt-actions"><h2>{receiverInitiated ? "Confirm money sent" : "Confirm this payment"}</h2>{receiverInitiated && <p className="text-secondary">Confirm that you sent {payment.receiver.name} {formatTaka(payment.amount)} outside the app.</p>}<button className="btn btn-primary" disabled={busy} onClick={() => setConfirmAction("accept")}>{receiverInitiated ? "Confirm money sent" : "Accept payment"}</button>{!showReject ? <button className="btn btn-danger" disabled={busy} onClick={() => setShowReject(true)}>{receiverInitiated ? "Reject record" : "Reject payment"}</button> : <div className="debt-reject"><label><span>Reason for rejection</span><textarea className="input" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /><span className="text-muted" style={{ textAlign: "right", fontWeight: 400 }}>{reason.length}/300</span></label><button className="btn btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => void mutate(`/api/debts/payments/${payment.id}/respond`, { decision: "reject", reason: reason.trim() })}>Confirm rejection</button><button className="btn btn-secondary" disabled={busy} onClick={() => setShowReject(false)}>Go back</button></div>}</div>}

      {payment.status === "pending" && isInitiator && <div className="card debt-actions"><h2>{receiverInitiated ? "Awaiting sender confirmation" : "Outgoing payment"}</h2>{receiverInitiated && <p className="text-secondary">This record has no balance effect until {payment.sender.name} confirms it.</p>}<button className="btn btn-danger" disabled={busy} onClick={() => setConfirmAction("cancel")}>Cancel record</button></div>}

      {payment.status === "accepted" && payment.source === "direct" && isReceiver && <div className="card debt-actions"><h2>Return this payment</h2><p className="text-secondary">Creates a new payment of the same amount for the original sender to confirm.</p><button className="btn btn-secondary" disabled={busy || !returnRequestId} onClick={() => setConfirmAction("reverse")}>Create return payment</button></div>}
      <ConfirmDialog open={confirmAction !== null} title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} tone={confirmCopy.tone} busy={busy} onCancel={() => setConfirmAction(null)} onConfirm={confirmSelectedAction} />
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-BD", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
}
