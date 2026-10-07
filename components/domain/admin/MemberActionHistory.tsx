"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemberActionView } from "@/types/acting";
import { memberFetch } from "@/lib/utils/member-fetch";

export default function MemberActionHistory({ memberId, admin = false }: { memberId?: string; admin?: boolean }) {
  const [items, setItems] = useState<MemberActionView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (next?: string) => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams();
      if (admin && memberId) query.set("memberId", memberId);
      if (next) query.set("cursor", next);
      const response = await memberFetch(`${admin ? "/api/admin/member-actions" : "/api/account/actions"}?${query}`);
      const payload = await response.json() as { data?: { actions: MemberActionView[]; nextCursor: string | null }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Could not load account activity.");
      setItems((current) => next ? [...current, ...payload.data!.actions] : payload.data!.actions); setCursor(payload.data.nextCursor);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please retry."); }
    finally { setLoading(false); }
  }, [admin, memberId]);
  useEffect(() => { void load(); }, [load]);
  return <section className="card acting-history" id="account-actions"><h2>{admin ? "Administrator member actions" : "Actions on your behalf"}</h2>
    {error && <div role="alert"><p className="text-negative">{error}</p><button className="btn btn-secondary" onClick={() => void load()}>Retry</button></div>}
    {loading && !items.length && <p>Loading activity…</p>}
    {!loading && !error && !items.length && <p className="text-secondary">No administrator actions recorded.</p>}
    {items.map((item) => <article className="acting-history__item" key={item.id}><strong>{item.admin.name} → {item.member.name}</strong><p>{item.action.replaceAll(".", " · ")}</p>
      <time>{new Date(item.createdAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</time>
      {item.reason && <p>Reason: {item.reason}</p>}
      <details><summary>View recorded changes</summary><pre>{JSON.stringify(item.changes, null, 2)}</pre></details>
    </article>)}
    {cursor && <button className="btn btn-secondary" disabled={loading} onClick={() => void load(cursor)}>Load more</button>}
  </section>;
}
