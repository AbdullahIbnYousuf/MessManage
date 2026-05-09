"use client";

import { useState, useCallback, useEffect } from "react";
import MembershipRequestCard from "@/components/domain/admin/MembershipRequestCard";

interface MemberRequest {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  requestedAt: string;
}

export default function MembershipRequestsClient() {
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/membership");
    const json = await res.json() as { data?: MemberRequest[] };
    setRequests(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : requests.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--color-text-muted)",
          }}
        >
          <svg
            width="40"
            height="40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ margin: "0 auto 1rem" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ fontWeight: 500 }}>All caught up!</div>
          <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>No pending membership requests.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {requests.map((req) => (
            <MembershipRequestCard key={req.id} request={req} onReviewed={load} />
          ))}
        </div>
      )}
    </div>
  );
}
