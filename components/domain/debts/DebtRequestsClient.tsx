"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { DebtRequestItem, DebtRequestPage } from "@/types/debts";
import DebtRequestCard from "@/components/domain/debts/DebtRequestCard";

export default function DebtRequestsClient({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [requests, setRequests] = useState<DebtRequestItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryString); params.set("limit", "25");
      if (cursor) params.set("cursor", cursor); else params.delete("cursor");
      const response = await fetch(`/api/debts/requests?${params.toString()}`);
      const json = await response.json() as { data?: DebtRequestPage; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not load debt requests.");
      setRequests((current) => cursor ? [...current, ...json.data!.requests] : json.data!.requests);
      setNextCursor(json.data.nextCursor);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load debt requests."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [queryString]);
  useEffect(() => { void load(); }, [load]);

  function setFilter(name: string, value: string) {
    const params = new URLSearchParams(queryString);
    if (value) params.set(name, value); else params.delete(name);
    router.replace(`/debts/requests${params.size ? `?${params.toString()}` : ""}`);
  }

  return <div className="page-container debt-page">
    <div className="section-header"><div><div className="debt-back"><Link href="/money">← Debts &amp; payments</Link></div><h1 className="debt-title">Debt requests</h1><p className="text-secondary debt-subtitle">Only you and the other participant can see these request details.</p></div><Link className="btn btn-primary" href="/debts/requests/new">Request debt</Link></div>
    <div className="card debt-filters"><label><span>Direction</span><select className="input" value={searchParams.get("direction") ?? "all"} onChange={(event) => setFilter("direction", event.target.value)}><option value="all">All requests</option><option value="incoming">Needs my response</option><option value="outgoing">Requested by me</option></select></label><label><span>Status</span><select className="input" value={searchParams.get("status") ?? ""} onChange={(event) => setFilter("status", event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label></div>
    {loading ? <div className="debt-state"><span className="spinner" /> Loading requests…</div> : error ? <div className="debt-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div> : requests.length === 0 ? <div className="debt-empty">No debt requests match these filters.</div> : <div className="debt-list">{requests.map((request) => <DebtRequestCard key={request.id} request={request} currentUserId={currentUserId} />)}</div>}
    {nextCursor && !loading && <button className="btn btn-secondary debt-load-more" disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? <><span className="spinner" /> Loading…</> : "Load more"}</button>}
  </div>;
}
