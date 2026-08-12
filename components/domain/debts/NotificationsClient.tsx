"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DebtNotificationItem, DebtNotificationPage } from "@/types/debts";
import { PageHeader } from "@/components/ui/Editorial";

export default function NotificationsClient() {
  const [items, setItems] = useState<DebtNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/notifications/inbox?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      const json = await response.json() as { data?: DebtNotificationPage; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not load notifications.");
      setItems((current) => cursor ? [...current, ...json.data!.notifications] : json.data!.notifications);
      setUnreadCount(json.data.unreadCount); setNextCursor(json.data.nextCursor);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load notifications."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function markOne(id: string) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not mark notification read.");
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : "Could not update notification."); }
    finally { setBusy(false); }
  }

  async function markAll() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not mark notifications read.");
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0);
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : "Could not update notifications."); }
    finally { setBusy(false); }
  }

  return <div className="page-container debt-page">
    <PageHeader eyebrow="Household updates" title="Notifications" description={`${unreadCount} unread money ${unreadCount === 1 ? "notification" : "notifications"}`} actions={unreadCount > 0 ? <button className="btn btn-secondary" disabled={busy} onClick={() => void markAll()}>Mark all read</button> : undefined} />
    {error && <div className="debt-error" role="alert">{error}</div>}
    {loading && items.length === 0 ? <div className="debt-state"><span className="spinner" /> Loading notifications…</div> : items.length === 0 ? <div className="debt-empty">You have no money notifications.</div> : <div className="debt-list">{items.map((item) => <article className={`debt-notification ${item.readAt ? "" : "unread"}`} key={item.id}><Link href={notificationHref(item)}><div className="debt-notification__top"><strong>{item.title}</strong>{!item.readAt && <span className="debt-unread-dot" aria-label="Unread" />}</div><p>{item.body}</p><time>{formatDate(item.createdAt)}</time></Link>{!item.readAt && <button className="btn btn-ghost" disabled={busy} onClick={() => void markOne(item.id)}>Mark read</button>}</article>)}</div>}
    {nextCursor && <button className="btn btn-secondary debt-load-more" disabled={loading} onClick={() => void load(nextCursor)}>Load more</button>}
  </div>;
}

function notificationHref(item: DebtNotificationItem): string {
  return item.entityType === "transfer"
    ? `/debts/payments/${item.entityId}`
    : item.entityType === "debt_request"
      ? `/debts/requests/${item.entityId}`
      : "/debts/ledger?type=obligation";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-BD", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
}
