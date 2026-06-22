"use client";

import { useState } from "react";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

interface Props {
  member: Member;
  currentUserId: string;
  onDeactivated: () => void;
}

interface DeactivatePreview {
  deactivatedAt: string;
  reason: "last_meal" | "joined_date";
}

export default function MemberRow({ member, currentUserId, onDeactivated }: Props) {
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deactivated, setDeactivated] = useState(member.status === "deactivated");
  const [role, setRole] = useState(member.role);

  // Deactivation confirmation state
  const [preview, setPreview] = useState<DeactivatePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDeactivateClick() {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/deactivate`);
      const json = await res.json() as { data?: DeactivatePreview; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not load deactivation preview.");
      } else if (json.data) {
        setPreview(json.data);
      }
    } catch {
      setError("Network error.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDeactivateConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/deactivate`, { method: "POST" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setDeactivated(true);
        setPreview(null);
        onDeactivated();
      }
    } catch {
      setError("Network error.");
    } finally {
      setConfirming(false);
    }
  }

  function handleDeactivateCancel() {
    setPreview(null);
    setError(null);
  }

  async function handleReactivate() {
    if (!confirm(`Reactivate ${member.name}? This will restore their future meal records.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/reactivate`, { method: "POST" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setDeactivated(false);
        onDeactivated();
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(newRole: string) {
    if (!confirm(`Change ${member.name}'s role to ${newRole}?`)) return;
    setRoleLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setRole(newRole);
      }
    } catch {
      setError("Network error.");
    } finally {
      setRoleLoading(false);
    }
  }

  const joinDate = new Date(member.joinedAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

  // Format the computed deactivation date nicely
  const previewDateStr = preview
    ? new Date(preview.deactivatedAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      })
    : null;

  const previewMessage =
    preview?.reason === "last_meal"
      ? "Based on their last recorded meal."
      : "This member never recorded a meal — date set to when they joined.";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatarUrl} alt={member.name} className="avatar avatar-md" />
        ) : (
          <div className="avatar-fallback avatar-md" style={{ fontSize: "0.875rem" }}>
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>{member.name}</span>
            {member.id === currentUserId && <span className="badge badge-muted">You</span>}
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem", overflowWrap: "anywhere" }}>
            {member.email}
          </div>
        </div>
        <span className={deactivated ? "badge badge-danger" : "badge badge-success"}>
          {deactivated ? "Deactivated" : "Active"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "0.75rem",
        }}
      >
        <div>
          <div className="text-muted" style={{ fontSize: "0.6875rem", marginBottom: "0.25rem" }}>
            Role
          </div>
          {member.id !== currentUserId && !deactivated ? (
            <select
              value={role}
              onChange={(event) => void handleRoleChange(event.target.value)}
              disabled={roleLoading || loading || previewLoading || confirming}
              className="input"
              style={{ minHeight: 44, textTransform: "capitalize" }}
            >
              <option value="admin">admin</option>
              <option value="member">member</option>
            </select>
          ) : (
            <div style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
              <span className={role === "admin" ? "badge badge-primary" : "badge badge-muted"}>
                {role}
              </span>
            </div>
          )}
        </div>
        <div>
          <div className="text-muted" style={{ fontSize: "0.6875rem", marginBottom: "0.25rem" }}>
            Joined
          </div>
          <div className="text-secondary" style={{ minHeight: 44, display: "flex", alignItems: "center", fontSize: "0.875rem" }}>
            {joinDate}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-negative" style={{ fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <Link
          href={`/admin/members/${member.id}/meals`}
          className="btn btn-primary"
          style={{ width: "100%", minHeight: 44 }}
        >
          Edit Meals
        </Link>

        {!deactivated && member.id !== currentUserId && !preview && (
          <button
            className="btn btn-ghost"
            onClick={() => void handleDeactivateClick()}
            disabled={previewLoading || confirming}
            style={{ width: "100%", minHeight: 44, color: "var(--color-danger)" }}
          >
            {previewLoading ? <span className="spinner" /> : "Deactivate"}
          </button>
        )}
        {deactivated && member.id !== currentUserId && (
          <button
            className="btn btn-ghost"
            onClick={() => void handleReactivate()}
            disabled={loading}
            style={{ width: "100%", minHeight: 44, color: "var(--color-success)" }}
          >
            {loading ? <span className="spinner" /> : "Reactivate"}
          </button>
        )}
      </div>

      {preview && (
        <div
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
            <span aria-hidden="true">📅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-danger)" }}>
                Will be deactivated from: {previewDateStr}
              </div>
              <div className="text-secondary" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
                {previewMessage}
              </div>
              <div className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.15rem" }}>
                They will be excluded from fridge bills and maid charges from the following month onwards.
              </div>
            </div>
          </div>
          <button
            className="btn"
            onClick={() => void handleDeactivateConfirm()}
            disabled={confirming}
            style={{ minHeight: 44, background: "var(--color-danger)", color: "#fff" }}
          >
            {confirming ? <span className="spinner" /> : "Confirm Deactivation"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleDeactivateCancel}
            disabled={confirming}
            style={{ minHeight: 44 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
