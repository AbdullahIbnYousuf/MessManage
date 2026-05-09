"use client";

import { useState, useCallback, useEffect } from "react";

interface EditRequest {
  id: string;
  requestedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  mealRecord: { date: string; mealCount: number };
}

export default function MealEditRequestsClient() {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, "approve" | "reject">>({});
  const [done, setDone] = useState<Record<string, "approved" | "rejected">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/meal-edit-requests");
    const json = await res.json() as { data?: EditRequest[] };
    setRequests(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handle(id: string, action: "approve" | "reject") {
    setActing((a) => ({ ...a, [id]: action }));
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/meal-edit-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setErrors((e) => ({ ...e, [id]: json.error ?? "Failed." }));
      } else {
        setDone((d) => ({ ...d, [id]: action === "approve" ? "approved" : "rejected" }));
      }
    } catch {
      setErrors((e) => ({ ...e, [id]: "Network error." }));
    } finally {
      setActing((a) => { const n = { ...a }; delete n[id]; return n; });
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-muted)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
        No pending meal edit requests.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {requests.map((r) => {
        const isDone = !!done[r.id];
        const isActing = !!acting[r.id];
        const outcome = done[r.id];
        const err = errors[r.id];

        return (
          <div
            key={r.id}
            className="card fade-in"
            style={{ display: "flex", alignItems: "center", gap: "1rem", opacity: isDone ? 0.5 : 1, transition: "opacity 0.3s" }}
          >
            {/* Avatar */}
            {r.user.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={r.user.avatarUrl} alt={r.user.name} className="avatar avatar-md" />
              : <div className="avatar-fallback" style={{ width: 36, height: 36, fontSize: "0.875rem" }}>{r.user.name.charAt(0)}</div>
            }

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.user.name}</div>
              <div className="text-secondary" style={{ fontSize: "0.8125rem" }}>
                Date: <strong>{r.mealRecord.date}</strong> · Current count: <strong>{r.mealRecord.mealCount}</strong>
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                Requested {new Date(r.requestedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              {isDone ? (
                <span className={outcome === "approved" ? "badge badge-success" : "badge badge-danger"}>
                  {outcome === "approved" ? "Approved" : "Rejected"}
                </span>
              ) : (
                <>
                  <button className="btn btn-sm btn-danger" onClick={() => void handle(r.id, "reject")} disabled={isActing}>
                    {acting[r.id] === "reject" ? <span className="spinner" /> : "Reject"}
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={() => void handle(r.id, "approve")} disabled={isActing}>
                    {acting[r.id] === "approve" ? <span className="spinner" /> : "Approve"}
                  </button>
                </>
              )}
            </div>

            {err && <div className="text-negative" style={{ fontSize: "0.75rem" }}>{err}</div>}
          </div>
        );
      })}
    </div>
  );
}
