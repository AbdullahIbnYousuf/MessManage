"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMonthLabel, formatTimestamp } from "@/lib/utils/dates";
import type { MealEditReview } from "@/types";

export default function MealEditRequestsClient() {
  const [requests, setRequests] = useState<MealEditReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState<Record<string, "approve" | "reject">>({});
  const [done, setDone] = useState<Record<string, "approved" | "rejected">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/meal-edit-requests");
      const json = await res.json() as { data?: MealEditReview[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load meal correction requests.");
      setRequests(json.data ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handle(id: string, action: "approve" | "reject") {
    setActing((current) => ({ ...current, [id]: action }));
    setErrors((current) => ({ ...current, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/meal-edit-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setErrors((current) => ({
          ...current,
          [id]: json.error ?? "The request could not be reviewed.",
        }));
      } else {
        setDone((current) => ({
          ...current,
          [id]: action === "approve" ? "approved" : "rejected",
        }));
      }
    } catch {
      setErrors((current) => ({ ...current, [id]: "Network error. Please try again." }));
    } finally {
      setActing((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="meal-review-loading">
        <span className="spinner" aria-label="Loading meal correction requests" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="notice notice-danger meal-review-load-error" role="alert">
        <span>{loadError}</span>
        <button className="btn btn-secondary" onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  if (requests.length === 0) {
    return <div className="empty-state">No pending meal correction requests.</div>;
  }

  return (
    <div className="meal-review-list">
      {requests.map((request) => {
        const isDone = Boolean(done[request.id]);
        const isActing = Boolean(acting[request.id]);
        const error = errors[request.id];
        const isBatch = request.kind === "batch";

        return (
          <article className={`card meal-review-card${isDone ? " is-complete" : ""}`} key={request.id}>
            <div className="meal-review-card__header">
              {request.user.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={request.user.avatarUrl} alt="" className="avatar avatar-md" />
                : <div className="avatar-fallback">{request.user.name.charAt(0)}</div>}
              <div className="meal-review-card__identity">
                <strong>{request.user.name}</strong>
                <span>
                  {isBatch
                    ? `${formatMonthLabel(`${request.month}-01`)} · ${request.changes.length} ${request.changes.length === 1 ? "change" : "changes"}`
                    : `${request.mealRecord.date} · Current count ${request.mealRecord.mealCount}`}
                </span>
                <small>Requested {formatTimestamp(request.requestedAt)}</small>
              </div>
              {isBatch && (
                <span className="badge badge-warning">
                  Net {request.mealDelta > 0 ? "+" : ""}{request.mealDelta} meals
                </span>
              )}
            </div>

            {isBatch && (
              <div className="meal-review-card__changes">
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-expanded={Boolean(expanded[request.id])}
                  onClick={() => setExpanded((current) => ({
                    ...current,
                    [request.id]: !current[request.id],
                  }))}
                >
                  {expanded[request.id] ? "Hide changes" : "View exact changes"}
                </button>
                {expanded[request.id] && (
                  <ul>
                    {request.changes.map((change) => (
                      <li key={change.requestId}>
                        <span>{change.date}</span>
                        <strong>
                          {change.originalMealCount === null ? "Not recorded" : change.originalMealCount}
                          {" → "}{change.proposedMealCount}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && <div className="notice notice-danger" role="alert">{error}</div>}

            <div className="meal-review-card__actions">
              {isDone ? (
                <span className={done[request.id] === "approved" ? "badge badge-success" : "badge badge-danger"}>
                  {done[request.id] === "approved" ? "Approved" : "Rejected"}
                </span>
              ) : (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => void handle(request.id, "reject")}
                    disabled={isActing}
                  >
                    {acting[request.id] === "reject" ? <span className="spinner" /> : "Reject all"}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void handle(request.id, "approve")}
                    disabled={isActing}
                  >
                    {acting[request.id] === "approve" ? <span className="spinner" /> : "Approve all"}
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
