"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { memberFetch, returnToAccountScreen } from "@/lib/utils/member-fetch";

export default function ActAsMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true); setError(null);
    try {
      const response = await memberFetch("/api/admin/acting-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, reason: reason.trim() }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not open member account.");
      returnToAccountScreen("/money");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please retry."); setConfirm(false); setBusy(false); }
  }
  return <div className="acting-entry">
    {!editing ? <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Act as member</button> : <>
      <label className="acting-reason">Reason for acting as {name}<textarea className="input" rows={3} minLength={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <p className="text-secondary">Use their member screens. Every change records your administrator identity.</p>
      <button className="btn btn-primary" disabled={reason.trim().length < 3 || busy} onClick={() => setConfirm(true)}>Review access</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => { setEditing(false); setError(null); }}>Cancel</button>
    </>}
    {error && <p className="text-negative" role="alert">{error}</p>}
    <ConfirmDialog open={confirm} title={`Act as ${name}?`} description={`Access lasts 30 minutes. ${name} will be notified, and all changes will identify you as the administrator. Reason: ${reason.trim()}`} confirmLabel="Act as member" busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void start()} />
  </div>;
}
