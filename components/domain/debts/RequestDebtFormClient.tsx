"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import type { DebtDashboardSummary, DebtRequestItem } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";

type Member = { id: string; name: string; nickname: string | null; status: string };

export default function RequestDebtFormClient({ currentUserId }: { currentUserId: string }) {
  const [clientRequestId, setClientRequestId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<DebtDashboardSummary | null>(null);
  const [debtorId, setDebtorId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<DebtRequestItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setClientRequestId(crypto.randomUUID()); }, []);
  useEffect(() => {
    void Promise.all([fetch("/api/members"), fetch("/api/debts/summary")]).then(async ([membersResponse, summaryResponse]) => {
      const membersJson = await membersResponse.json() as { data?: Member[]; error?: string };
      const summaryJson = await summaryResponse.json() as { data?: DebtDashboardSummary; error?: string };
      if (!membersResponse.ok || !summaryResponse.ok) throw new Error(membersJson.error ?? summaryJson.error ?? "Could not load the form.");
      setMembers((membersJson.data ?? []).filter((member) => member.status === "active" && member.id !== currentUserId));
      setSummary(summaryJson.data ?? null);
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load the form."));
  }, [currentUserId]);

  const debtor = members.find((member) => member.id === debtorId);
  const pairwise = summary?.pairwise.find((position) => position.memberId === debtorId);
  const parsedAmount = useMemo(() => { try { return new Decimal(amount || 0); } catch { return null; } }, [amount]);
  const amountHasValidFormat = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount);
  const valid = Boolean(debtorId && clientRequestId && amountHasValidFormat && parsedAmount?.gt(0) && description.trim().length >= 3 && description.trim().length <= 300);

  function review(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!valid) { setError("Select a member, enter a valid amount, and explain the debt in 3–300 characters."); return; }
    setConfirming(true);
  }

  async function submit() {
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/debts/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtorUserId: debtorId, amount, description: description.trim(), clientRequestId }),
      });
      const json = await response.json() as { data?: DebtRequestItem; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Debt request could not be created.");
      setCreated(json.data);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Debt request could not be created."); }
    finally { setSubmitting(false); }
  }

  if (created) return <div className="page-container debt-page"><div className="debt-success"><h1>Debt confirmation requested</h1><p>{created.debtor.name} must accept before this changes either member’s balance.</p><Link className="btn btn-primary" href={`/debts/requests/${created.id}`}>View request</Link><Link className="btn btn-secondary" href="/money">Back to debts</Link></div></div>;

  return <div className="page-container debt-page">
    <div className="debt-back"><Link href="/money">← Debts &amp; payments</Link></div>
    <h1 className="debt-title">Request debt</h1>
    <p className="text-secondary debt-subtitle">Ask a member to confirm that they owe you. Nothing changes until they accept.</p>
    <form className="card debt-form" onSubmit={review}>
      <label><span>Who owes you?</span><select className="input" required value={debtorId} onChange={(event) => { setDebtorId(event.target.value); setConfirming(false); }}><option value="">Select a member</option>{members.map((member) => <option value={member.id} key={member.id}>{member.nickname || member.name}</option>)}</select></label>
      {debtorId && <div className="debt-context"><strong>Current position</strong><span>{pairwise?.direction === "you_owe" ? `You currently owe ${debtor?.nickname || debtor?.name} ${formatTaka(new Decimal(pairwise.position).abs())}.` : pairwise?.direction === "owes_you" ? `${debtor?.nickname || debtor?.name} currently owes you ${formatTaka(pairwise.position)}.` : "There is currently no confirmed debt between you."}</span></div>}
      <label><span>Amount (BDT)</span><input className="input" inputMode="decimal" placeholder="0.00" required value={amount} onChange={(event) => { setAmount(event.target.value); setConfirming(false); }} /></label>
      <label><span>Why is this debt owed?</span><textarea className="input" rows={4} maxLength={300} required value={description} onChange={(event) => { setDescription(event.target.value); setConfirming(false); }} placeholder="Describe the expense or agreement clearly." /><span className="text-muted" style={{ textAlign: "right", fontWeight: 400 }}>{description.length}/300</span></label>
      {error && <div className="debt-error" role="alert">{error}</div>}
      {!confirming ? <button className="btn btn-primary" disabled={!valid} type="submit">Review debt request</button> : <div className="debt-confirm"><h2>Confirm request</h2><p>You are asking <strong>{debtor?.nickname || debtor?.name}</strong> to confirm they owe you <strong>{formatTaka(amount)}</strong>.</p><p className="text-secondary">Reason: {description.trim()}</p><button className="btn btn-primary" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? <><span className="spinner" /> Sending…</> : "Confirm and send"}</button><button className="btn btn-secondary" type="button" disabled={submitting} onClick={() => setConfirming(false)}>Go back</button></div>}
    </form>
  </div>;
}
