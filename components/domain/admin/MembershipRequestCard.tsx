"use client";

import { useState } from "react";

interface Request {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  requestedAt: string;
}

interface Props {
  request: Request;
  onReviewed: () => void;
}

export default function MembershipRequestCard({ request, onReviewed }: Props) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  type Outcome = "approved" | "rejected";
  const [done, setDone] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "approve" | "reject") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/membership/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setDone(action === "approve" ? "approved" : "rejected");
        setTimeout(onReviewed, 800);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const initials = request.name.charAt(0).toUpperCase();
  const date = new Date(request.requestedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="card fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        opacity: done ? 0.5 : 1,
        transition: "opacity 0.3s",
      }}
    >
      {/* Avatar */}
      {request.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={request.avatarUrl}
          alt={request.name}
          className="avatar avatar-lg"
        />
      ) : (
        <div className="avatar-fallback avatar-lg" style={{ fontSize: "1.25rem" }}>
          {initials}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{request.name}</div>
        <div className="text-secondary" style={{ fontSize: "0.8125rem" }}>{request.email}</div>
        <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
          Requested {date}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        {done ? (
          <span className={done === "approved" ? "badge badge-success" : "badge badge-danger"}>
            {done === "approved" ? "Approved" : "Rejected"}
          </span>
        ) : (
          <>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => handle("reject")}
              disabled={loading !== null}
            >
              {loading === "reject" ? <span className="spinner" /> : "Reject"}
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handle("approve")}
              disabled={loading !== null}
            >
              {loading === "approve" ? <span className="spinner" /> : "Approve"}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="text-negative" style={{ fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
