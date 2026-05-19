"use client";

import { useState } from "react";

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

export default function MemberRow({ member, currentUserId, onDeactivated }: Props) {
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deactivated, setDeactivated] = useState(member.status === "deactivated");
  const [role, setRole] = useState(member.role);

  async function handleDeactivate() {
    if (!confirm(`Deactivate ${member.name}? This will zero out all their future meal records.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/deactivate`, { method: "POST" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setDeactivated(true);
        onDeactivated();
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
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
        onDeactivated(); // Note: could rename this to onStatusChanged but keeping it for simplicity
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
  });

  return (
    <tr>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.avatarUrl} alt={member.name} className="avatar avatar-sm" />
          ) : (
            <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{member.name}</div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>{member.email}</div>
          </div>
        </div>
      </td>
      <td>
        {member.id !== currentUserId && !deactivated ? (
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={roleLoading || loading}
            className="input input-sm"
            style={{ width: "auto", minWidth: "90px", padding: "0.25rem 0.5rem", height: "auto" }}
          >
            <option value="admin">admin</option>
            <option value="member">member</option>
          </select>
        ) : (
          <span className={role === "admin" ? "badge badge-primary" : "badge badge-muted"}>
            {role}
          </span>
        )}
      </td>
      <td>
        <span className={deactivated ? "badge badge-danger" : "badge badge-success"}>
          {deactivated ? "Deactivated" : "Active"}
        </span>
      </td>
      <td className="text-secondary" style={{ fontSize: "0.8125rem" }}>{joinDate}</td>
      <td>
        {error && <span className="text-negative" style={{ fontSize: "0.75rem", marginRight: "0.5rem" }}>{error}</span>}
        {!deactivated && member.id !== currentUserId && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleDeactivate}
            disabled={loading}
            style={{ color: "var(--color-danger)" }}
          >
            {loading ? <span className="spinner" /> : "Deactivate"}
          </button>
        )}
        {deactivated && member.id !== currentUserId && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleReactivate}
            disabled={loading}
            style={{ color: "var(--color-success)" }}
          >
            {loading ? <span className="spinner" /> : "Reactivate"}
          </button>
        )}
        {member.id === currentUserId && (
          <span className="text-muted" style={{ fontSize: "0.75rem" }}>You</span>
        )}
      </td>
    </tr>
  );
}
