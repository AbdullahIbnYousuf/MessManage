"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import type { DebtDashboardSummary, DebtPaymentLedgerEntry } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";

type Member = { id: string; name: string; nickname: string | null; status: string };
type MemberDetail = { user: { bkashNumber: string | null; bankName: string | null; bankAccountNumber: string | null } };

export default function PaymentFormClient({ currentUserId }: { currentUserId: string }) {
  const [requestId, setRequestId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<DebtDashboardSummary | null>(null);
  const [receiverId, setReceiverId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentReference, setPaymentReference] = useState<MemberDetail["user"] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<DebtPaymentLedgerEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setRequestId(crypto.randomUUID()); }, []);
  useEffect(() => {
    void Promise.all([fetch("/api/members"), fetch("/api/debts/summary")])
      .then(async ([memberResponse, summaryResponse]) => {
        const memberJson = await memberResponse.json() as { data?: Member[]; error?: string };
        const summaryJson = await summaryResponse.json() as { data?: DebtDashboardSummary; error?: string };
        if (!memberResponse.ok || !summaryResponse.ok) throw new Error(memberJson.error ?? summaryJson.error ?? "Could not load payment form.");
        setMembers((memberJson.data ?? []).filter((member) => member.status === "active" && member.id !== currentUserId));
        setSummary(summaryJson.data ?? null);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load payment form."));
  }, [currentUserId]);

  useEffect(() => {
    setConfirming(false);
    setPaymentReference(null);
    if (!receiverId) return;
    void fetch(`/api/members/${receiverId}`)
      .then(async (response) => {
        const json = await response.json() as { data?: MemberDetail };
        if (response.ok) setPaymentReference(json.data?.user ?? null);
      });
  }, [receiverId]);

  const receiver = members.find((member) => member.id === receiverId);
  const pairwise = summary?.pairwise.find((position) => position.memberId === receiverId);
  const amountDecimal = useMemo(() => {
    try { return new Decimal(amount || 0); } catch { return null; }
  }, [amount]);
  const owedAmount = pairwise?.direction === "you_owe" ? new Decimal(pairwise.position).abs() : new Decimal(0);
  const overpayment = amountDecimal?.gt(0) === true && amountDecimal.gt(owedAmount);
  const valid = Boolean(receiverId && requestId && amountDecimal?.gt(0) && amountDecimal.decimalPlaces() <= 2 && description.length <= 240);

  function startConfirmation(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!valid) { setError("Choose a member and enter a positive amount with at most two decimal places."); return; }
    setConfirming(true);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/debts/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverUserId: receiverId, amount, description: description.trim() || undefined, clientRequestId: requestId }),
      });
      const json = await response.json() as { data?: DebtPaymentLedgerEntry; error?: string; code?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Payment could not be recorded.");
      setCreated(json.data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Payment could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <div className="page-container debt-page"><div className="debt-success"><h1>Payment sent for confirmation</h1><p>{created.receiver.name} must accept it before the payment changes anyone’s debt.</p><Link className="btn btn-primary" href={`/debts/payments/${created.id}`}>View payment</Link><Link className="btn btn-secondary" href="/debts">Back to DebtSync</Link></div></div>;

  return (
    <div className="page-container debt-page">
      <div className="debt-back"><Link href="/debts">← DebtSync</Link></div>
      <h1 className="debt-title">Record a payment</h1>
      <p className="text-secondary debt-subtitle">This records a confirmation between members. DebtSync does not move money.</p>
      <form className="card debt-form" onSubmit={startConfirmation}>
        <label><span>Paid to</span><select className="input" value={receiverId} onChange={(event) => setReceiverId(event.target.value)} required><option value="">Select a member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></label>

        {receiverId && <div className="debt-context"><strong>Current position</strong><span>{pairwise?.direction === "you_owe" ? `You owe ${receiver?.nickname || receiver?.name} ${formatTaka(owedAmount)}` : pairwise?.direction === "owes_you" ? `${receiver?.nickname || receiver?.name} owes you ${formatTaka(pairwise.position)}` : "No current debt between you."}</span>{paymentReference && (paymentReference.bkashNumber || paymentReference.bankAccountNumber) && <span className="text-secondary">Payment reference: {paymentReference.bkashNumber ? `bKash ${paymentReference.bkashNumber}` : `${paymentReference.bankName ?? "Bank"} ${paymentReference.bankAccountNumber}`}</span>}</div>}

        <label><span>Amount (BDT)</span><input className="input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setConfirming(false); }} required /></label>
        {overpayment && <div className="debt-warning" role="status">This is more than your current debt to this member. It is allowed, but acceptance will reverse the remaining direction.</div>}
        <label><span>Description <span className="text-muted">(optional)</span></span><textarea className="input" rows={3} maxLength={240} value={description} onChange={(event) => { setDescription(event.target.value); setConfirming(false); }} placeholder="Cash, bKash transaction, bank transfer…" /></label>
        {error && <div className="debt-error" role="alert">{error}</div>}

        {!confirming ? <button className="btn btn-primary" type="submit" disabled={!valid}>Review payment</button> : <div className="debt-confirm"><h2>Confirm payment record</h2><p>You are recording that you paid <strong>{receiver?.nickname || receiver?.name}</strong> <strong>{formatTaka(amount)}</strong>. They must accept it.</p><button className="btn btn-primary" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? <><span className="spinner" /> Recording…</> : "Confirm and send"}</button><button className="btn btn-secondary" type="button" disabled={submitting} onClick={() => setConfirming(false)}>Go back</button></div>}
      </form>
    </div>
  );
}
