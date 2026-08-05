"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DebtRequestItem } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";
import { DebtStatusBadge } from "@/components/domain/debts/DebtLedgerEntryCard";

export default function DebtRequestDetailClient({ requestId, currentUserId }: { requestId: string; currentUserId: string }) {
  const [request, setRequest] = useState<DebtRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/debts/requests/${requestId}`);
      const json = await response.json() as { data?: DebtRequestItem; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not load debt request.");
      setRequest(json.data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load debt request."); }
    finally { setLoading(false); }
  }, [requestId]);
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: string, body?: Record<string, string>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(path, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json() as { error?: string; currentStatus?: string };
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(`${json.error ?? "Debt request could not be updated."}${json.currentStatus ? ` Current status: ${json.currentStatus}.` : ""}`);
      }
      setConfirmAccept(false); setShowReject(false); setReason(""); await load();
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : "Debt request could not be updated."); }
    finally { setBusy(false); }
  }

  if (loading && !request) return <div className="page-container debt-state"><span className="spinner" /> Loading debt request…</div>;
  if (!request) return <div className="page-container debt-page"><div className="debt-error">{error ?? "Debt request not found."}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div></div>;

  const isRequester = request.requester.id === currentUserId;
  const isDebtor = request.debtor.id === currentUserId;
  return <div className="page-container debt-page">
    <div className="debt-back"><Link href="/debts/requests">← Debt requests</Link></div>
    <div className="section-header"><div><h1 className="debt-title">Debt request</h1><p className="text-secondary debt-subtitle">Private to both participants</p></div><DebtStatusBadge status={request.status} /></div>
    <div className="card debt-detail"><div className="debt-detail-amount">{formatTaka(request.amount)}</div><p className="debt-direction">{request.requester.name} asked {request.debtor.name} to confirm this debt.</p><dl className="debt-detail-list"><div><dt>Proposed creditor</dt><dd>{request.requester.name}{isRequester ? " (you)" : ""}</dd></div><div><dt>Proposed debtor</dt><dd>{request.debtor.name}{isDebtor ? " (you)" : ""}</dd></div><div><dt>Created</dt><dd>{formatDate(request.createdAt)}</dd></div>{request.respondedAt && <div><dt>Responded</dt><dd>{formatDate(request.respondedAt)}</dd></div>}{request.cancelledAt && <div><dt>Cancelled</dt><dd>{formatDate(request.cancelledAt)}</dd></div>}<div><dt>Description</dt><dd>{request.description}</dd></div>{request.rejectionReason && <div><dt>Rejection reason</dt><dd>{request.rejectionReason}</dd></div>}</dl>{request.obligationId && <Link className="debt-related-link" href="/debts/ledger?type=obligation">View accepted obligation →</Link>}</div>
    <div className="debt-note">Accepting this request adds a permanent debt obligation. MessManage does not move money.</div>
    {error && <div className="debt-error" role="alert">{error}</div>}
    {request.status === "pending" && isDebtor && <div className="card debt-actions"><h2>Respond to request</h2>{!confirmAccept && !showReject && <><button className="btn btn-primary" disabled={busy} onClick={() => setConfirmAccept(true)}>Accept debt</button><button className="btn btn-danger" disabled={busy} onClick={() => setShowReject(true)}>Reject request</button></>}{confirmAccept && <div className="debt-confirm"><h2>Confirm acceptance</h2><p>You confirm that you owe <strong>{request.requester.name}</strong> <strong>{formatTaka(request.amount)}</strong>. This creates a permanent obligation.</p><button className="btn btn-primary" disabled={busy} onClick={() => void mutate(`/api/debts/requests/${request.id}/respond`, { decision: "accept" })}>{busy ? <><span className="spinner" /> Accepting…</> : "Confirm debt"}</button><button className="btn btn-secondary" disabled={busy} onClick={() => setConfirmAccept(false)}>Go back</button></div>}{showReject && <div className="debt-reject"><label><span>Reason for rejection</span><textarea className="input" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /><span className="text-muted" style={{ textAlign: "right", fontWeight: 400 }}>{reason.length}/300</span></label><button className="btn btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => void mutate(`/api/debts/requests/${request.id}/respond`, { decision: "reject", reason: reason.trim() })}>Confirm rejection</button><button className="btn btn-secondary" disabled={busy} onClick={() => setShowReject(false)}>Go back</button></div>}</div>}
    {request.status === "pending" && isRequester && <div className="card debt-actions"><h2>Pending confirmation</h2><p className="text-secondary">This request has no balance effect yet.</p><button className="btn btn-danger" disabled={busy} onClick={() => { if (confirm("Cancel this pending debt request?")) void mutate(`/api/debts/requests/${request.id}/cancel`); }}>Cancel request</button></div>}
  </div>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-BD", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
}
