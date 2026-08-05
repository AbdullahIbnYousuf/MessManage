"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { DebtLedgerEntry, DebtLedgerPage } from "@/types/debts";
import DebtLedgerEntryCard from "@/components/domain/debts/DebtLedgerEntryCard";

type Member = { id: string; name: string; nickname: string | null };

export default function DebtLedgerClient({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<DebtLedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryString);
      params.set("limit", "25");
      if (cursor) params.set("cursor", cursor); else params.delete("cursor");
      const response = await fetch(`/api/debts/ledger?${params.toString()}`);
      const json = await response.json() as { data?: DebtLedgerPage; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not load ledger.");
      setEntries((current) => cursor ? [...current, ...json.data!.entries] : json.data!.entries);
      setNextCursor(json.data.nextCursor);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load ledger."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [queryString]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void fetch("/api/members").then((response) => response.json()).then((json: { data?: Member[] }) => setMembers(json.data ?? [])); }, []);

  function setFilter(name: string, value: string) {
    const params = new URLSearchParams(queryString);
    if (value) params.set(name, value); else params.delete(name);
    if (name === "type" && value === "obligation") params.delete("status");
    router.replace(`/debts/ledger${params.size ? `?${params.toString()}` : ""}`);
  }

  const type = searchParams.get("type") ?? "all";
  return <div className="page-container debt-page">
    <div className="section-header"><div><div className="debt-back"><Link href="/debts">← Balances &amp; Payments</Link></div><h1 className="debt-title">Money ledger</h1><p className="text-secondary debt-subtitle">Monthly closing obligations and member-confirmed payments.</p></div><div className="debt-command-grid"><Link href="/debts/payments/new" className="btn btn-primary debt-full-mobile">Record money</Link></div></div>
    <div className="card debt-filters">
      <label><span>Member</span><select className="input" value={searchParams.get("memberId") ?? ""} onChange={(event) => setFilter("memberId", event.target.value)}><option value="">All members</option>{members.map((member) => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></label>
      <label><span>Record type</span><select className="input" value={type} onChange={(event) => setFilter("type", event.target.value)}><option value="all">All records</option><option value="obligation">Obligations</option><option value="payment">Payments</option></select></label>
      <label><span>Payment status</span><select className="input" disabled={type === "obligation"} value={searchParams.get("status") ?? ""} onChange={(event) => setFilter("status", event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label>
      <label><span>From date</span><input className="input" type="date" value={searchParams.get("from") ?? ""} onChange={(event) => setFilter("from", event.target.value)} /></label>
      <label><span>To date</span><input className="input" type="date" value={searchParams.get("to") ?? ""} onChange={(event) => setFilter("to", event.target.value)} /></label>
    </div>
    {loading ? <div className="debt-state"><span className="spinner" /> Loading ledger…</div> : error ? <div className="debt-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div> : entries.length === 0 ? <div className="debt-empty">No records match these filters.</div> : <div className="debt-list">{entries.map((entry) => <DebtLedgerEntryCard key={`${entry.type}-${entry.id}`} entry={entry} currentUserId={currentUserId} />)}</div>}
    {nextCursor && !loading && <button className="btn btn-secondary debt-load-more" disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? <><span className="spinner" /> Loading…</> : "Load more"}</button>}
  </div>;
}
