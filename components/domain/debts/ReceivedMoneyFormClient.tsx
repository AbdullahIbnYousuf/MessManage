"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import type { DebtDashboardSummary, DebtPaymentLedgerEntry } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";

type Member = { id: string; name: string; nickname: string | null; status: string };

export default function ReceivedMoneyFormClient({ currentUserId }: { currentUserId: string }) {
  const [clientRequestId, setClientRequestId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<DebtDashboardSummary | null>(null);
  const [senderId, setSenderId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<DebtPaymentLedgerEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setClientRequestId(crypto.randomUUID()); }, []);
  useEffect(() => {
    void Promise.all([fetch("/api/members"), fetch("/api/debts/summary")])
      .then(async ([memberResponse, summaryResponse]) => {
        const memberJson = await memberResponse.json() as { data?: Member[]; error?: string };
        const summaryJson = await summaryResponse.json() as { data?: DebtDashboardSummary; error?: string };
        if (!memberResponse.ok || !summaryResponse.ok) {
          throw new Error(memberJson.error ?? summaryJson.error ?? "Could not load the form.");
        }
        setMembers((memberJson.data ?? []).filter(
          (member) => member.status === "active" && member.id !== currentUserId
        ));
        setSummary(summaryJson.data ?? null);
      })
      .catch((loadError: unknown) => setError(
        loadError instanceof Error ? loadError.message : "Could not load the form."
      ));
  }, [currentUserId]);

  const sender = members.find((member) => member.id === senderId);
  const pairwise = summary?.pairwise.find((position) => position.memberId === senderId);
  const parsedAmount = useMemo(() => {
    try { return new Decimal(amount || 0); } catch { return null; }
  }, [amount]);
  const amountHasValidFormat = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount);
  const valid = Boolean(
    senderId
    && clientRequestId
    && amountHasValidFormat
    && parsedAmount?.gt(0)
    && description.trim().length <= 300
  );

  function review(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!valid) {
      setError("Select a member and enter a positive amount with at most two decimal places.");
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/debts/payments/received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUserId: senderId,
          amount,
          description: description.trim() || undefined,
          clientRequestId,
        }),
      });
      const json = await response.json() as { data?: DebtPaymentLedgerEntry; error?: string };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Received money could not be recorded.");
      }
      setCreated(json.data);
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : "Received money could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return <div className="page-container debt-page"><div className="debt-success">
      <h1>Money received sent for confirmation</h1>
      <p>{created.sender.name} must confirm they sent it before this changes either member&apos;s balance.</p>
      <Link className="btn btn-primary" href={`/debts/payments/${created.id}`}>View record</Link>
      <Link className="btn btn-secondary" href="/debts">Back to DebtSync</Link>
    </div></div>;
  }

  return <div className="page-container debt-page">
    <div className="debt-back"><Link href="/debts">← DebtSync</Link></div>
    <h1 className="debt-title">Record money received</h1>
    <p className="text-secondary debt-subtitle">Record money you already received outside DebtSync. The sender must confirm it.</p>
    <form className="card debt-form" onSubmit={review}>
      <label><span>Received from</span><select className="input" required value={senderId} onChange={(event) => { setSenderId(event.target.value); setConfirming(false); }}><option value="">Select a member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></label>
      {senderId && <div className="debt-context"><strong>Current position</strong><span>{pairwise?.direction === "you_owe" ? `You currently owe ${sender?.nickname || sender?.name} ${formatTaka(new Decimal(pairwise.position).abs())}.` : pairwise?.direction === "owes_you" ? `${sender?.nickname || sender?.name} currently owes you ${formatTaka(pairwise.position)}.` : "There is currently no confirmed debt between you."}</span></div>}
      <label><span>Amount (BDT)</span><input className="input" inputMode="decimal" placeholder="0.00" required value={amount} onChange={(event) => { setAmount(event.target.value); setConfirming(false); }} /></label>
      <div className="debt-warning" role="status">If confirmed, {sender?.nickname || sender?.name || "the sender"} receives credit for this amount against you. Existing balances will net automatically.</div>
      <label><span>Description <span className="text-muted">(optional)</span></span><textarea className="input" rows={3} maxLength={300} value={description} onChange={(event) => { setDescription(event.target.value); setConfirming(false); }} placeholder="Cash, bKash transfer, short-term loan…" /><span className="text-muted" style={{ textAlign: "right", fontWeight: 400 }}>{description.length}/300</span></label>
      {error && <div className="debt-error" role="alert">{error}</div>}
      {!confirming
        ? <button className="btn btn-primary" disabled={!valid} type="submit">Review received money</button>
        : <div className="debt-confirm"><h2>Confirm record</h2><p>You are recording that you received <strong>{formatTaka(amount)}</strong> from <strong>{sender?.nickname || sender?.name}</strong>.</p><p className="text-secondary">They must confirm sending it before your debt changes.</p><button className="btn btn-primary" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? <><span className="spinner" /> Recording…</> : "Confirm and send"}</button><button className="btn btn-secondary" type="button" disabled={submitting} onClick={() => setConfirming(false)}>Go back</button></div>}
    </form>
  </div>;
}
