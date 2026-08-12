"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import type { DebtDashboardSummary, DebtPaymentLedgerEntry } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";
import { PageHeader } from "@/components/ui/Editorial";

type Member = { id: string; name: string; nickname: string | null; status: string };
type MemberDetail = { user: { bkashNumber: string | null; bankName: string | null; bankAccountNumber: string | null } };
type MoneyDirection = "sent" | "received";

export default function PaymentFormClient({
  currentUserId,
  initialMemberId,
  initialDirection,
}: {
  currentUserId: string;
  initialMemberId?: string;
  initialDirection?: MoneyDirection;
}) {
  const [requestId, setRequestId] = useState("");
  const [direction, setDirection] = useState<MoneyDirection>(initialDirection ?? "sent");
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<DebtDashboardSummary | null>(null);
  const [memberId, setMemberId] = useState("");
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
        if (!memberResponse.ok || !summaryResponse.ok) {
          throw new Error(memberJson.error ?? summaryJson.error ?? "Could not load the form.");
        }
        const activeMembers = (memberJson.data ?? []).filter(
          (member) => member.status === "active" && member.id !== currentUserId
        );
        setMembers(activeMembers);
        if (initialMemberId && activeMembers.some((member) => member.id === initialMemberId)) {
          setMemberId(initialMemberId);
        }
        setSummary(summaryJson.data ?? null);
      })
      .catch((loadError: unknown) => setError(
        loadError instanceof Error ? loadError.message : "Could not load the form."
      ));
  }, [currentUserId, initialMemberId]);

  useEffect(() => {
    setConfirming(false);
    setPaymentReference(null);
    if (direction !== "sent" || !memberId) return;
    void fetch(`/api/members/${memberId}`)
      .then(async (response) => {
        const json = await response.json() as { data?: MemberDetail };
        if (response.ok) setPaymentReference(json.data?.user ?? null);
      });
  }, [direction, memberId]);

  const member = members.find((candidate) => candidate.id === memberId);
  const memberName = member?.nickname || member?.name;
  const pairwise = summary?.pairwise.find((position) => position.memberId === memberId);
  const amountDecimal = useMemo(() => {
    try { return new Decimal(amount || 0); } catch { return null; }
  }, [amount]);
  const amountHasValidFormat = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount);
  const valid = Boolean(
    memberId
    && requestId
    && amountHasValidFormat
    && amountDecimal?.gt(0)
    && description.trim().length <= 300
  );
  const currentPosition = new Decimal(pairwise?.position ?? 0);
  const projectedPosition = amountDecimal?.gt(0)
    ? currentPosition.plus(direction === "sent" ? amountDecimal : amountDecimal.neg())
    : null;
  const fullBalanceAmount = direction === "sent" && currentPosition.lt(0)
    ? currentPosition.abs().toFixed(2)
    : direction === "received" && currentPosition.gt(0)
      ? currentPosition.toFixed(2)
      : null;

  function chooseDirection(nextDirection: MoneyDirection) {
    setDirection(nextDirection);
    setConfirming(false);
    setError(null);
  }

  function startConfirmation(event: FormEvent) {
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
      const received = direction === "received";
      const response = await fetch(
        received ? "/api/debts/payments/received" : "/api/debts/payments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(received ? { senderUserId: memberId } : { receiverUserId: memberId }),
            amount,
            description: description.trim() || undefined,
            clientRequestId: requestId,
          }),
        }
      );
      const json = await response.json() as { data?: DebtPaymentLedgerEntry; error?: string };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Money record could not be created.");
      }
      setCreated(json.data);
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : "Money record could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const confirmer = direction === "sent" ? created.receiver.name : created.sender.name;
    return <div className="page-container debt-page"><div className="debt-success">
      <h1>Sent for confirmation</h1>
      <p>{confirmer} must confirm {direction === "sent" ? "receiving" : "sending"} the money before this changes either member&apos;s balance.</p>
      <Link className="btn btn-primary" href={`/debts/payments/${created.id}`}>View record</Link>
      <Link className="btn btn-secondary" href="/money">Back to debts</Link>
    </div></div>;
  }

  return <div className="page-container debt-page">
    <div className="debt-back"><Link href="/money">← Debts &amp; payments</Link></div>
    <PageHeader eyebrow="Confirmed member money" title="Record money" description="Record money that already moved outside the app. The other member must confirm it." />
    <form className="card debt-form" onSubmit={startConfirmation}>
      <fieldset className="debt-money-direction">
        <legend>What happened?</legend>
        <div className="debt-money-direction__options">
          <button type="button" className={direction === "sent" ? "active" : ""} aria-pressed={direction === "sent"} disabled={submitting} onClick={() => chooseDirection("sent")}>
            <strong><span className="debt-cash-sign" aria-hidden="true">−</span> Money sent</strong>
            <span>I sent money to another member.</span>
          </button>
          <button type="button" className={direction === "received" ? "active" : ""} aria-pressed={direction === "received"} disabled={submitting} onClick={() => chooseDirection("received")}>
            <strong><span className="debt-cash-sign" aria-hidden="true">+</span> Money received</strong>
            <span>I received money from another member.</span>
          </button>
        </div>
      </fieldset>

      <label><span>{direction === "sent" ? "Paid to" : "Received from"}</span><select className="input" required value={memberId} onChange={(event) => { setMemberId(event.target.value); setConfirming(false); }}><option value="">Select a member</option>{members.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nickname || candidate.name}</option>)}</select></label>

      {memberId && <div className="debt-context"><strong>Current position</strong><span>{pairwise?.direction === "you_owe" ? `You currently owe ${memberName} ${formatTaka(currentPosition.abs())}.` : pairwise?.direction === "owes_you" ? `${memberName} currently owes you ${formatTaka(currentPosition)}.` : "There is currently no confirmed debt between you."}</span>{paymentReference && (paymentReference.bkashNumber || paymentReference.bankAccountNumber) && <span className="text-secondary">Payment reference: {paymentReference.bkashNumber ? `bKash ${paymentReference.bkashNumber}` : `${paymentReference.bankName ?? "Bank"} ${paymentReference.bankAccountNumber}`}</span>}{fullBalanceAmount && <button type="button" className="debt-use-balance" onClick={() => { setAmount(fullBalanceAmount); setConfirming(false); }}>Use full balance · {formatTaka(fullBalanceAmount)}</button>}</div>}

      <label><span>Amount (BDT)</span><input className="input" inputMode="decimal" placeholder="0.00" required value={amount} onChange={(event) => { setAmount(event.target.value); setConfirming(false); }} /></label>

      {memberId && projectedPosition && <div className="debt-warning" role="status"><strong>{direction === "sent" ? "You receive credit for sending this money." : `${memberName} receives credit for sending this money.`}</strong><br />Based on the current confirmed balance, {projectedPosition.gt(0) ? `${memberName} would owe you ${formatTaka(projectedPosition)}.` : projectedPosition.lt(0) ? `you would owe ${memberName} ${formatTaka(projectedPosition.abs())}.` : "your position would be settled."}</div>}

      <label><span>Description <span className="text-muted">(optional)</span></span><textarea className="input" rows={3} maxLength={300} value={description} onChange={(event) => { setDescription(event.target.value); setConfirming(false); }} placeholder="Cash, bKash transaction, bank transfer…" /><span className="text-muted" style={{ textAlign: "right", fontWeight: 400 }}>{description.length}/300</span></label>
      {error && <div className="debt-error" role="alert">{error}</div>}

      {!confirming
        ? <button className="btn btn-primary" disabled={!valid} type="submit">Review record</button>
        : <div className="debt-confirm"><h2>Confirm money record</h2><p>You are recording that you <strong>{direction === "sent" ? "sent" : "received"} {formatTaka(amount)}</strong> {direction === "sent" ? "to" : "from"} <strong>{memberName}</strong>.</p><p className="text-secondary">{memberName} must confirm {direction === "sent" ? "receiving" : "sending"} it before balances change.</p><button className="btn btn-primary" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? <><span className="spinner" /> Recording…</> : "Send for confirmation"}</button><button className="btn btn-secondary" type="button" disabled={submitting} onClick={() => setConfirming(false)}>Go back</button></div>}
    </form>
  </div>;
}
