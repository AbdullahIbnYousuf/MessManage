"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

export default function MembersDirectoryClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/members");
      const json = await res.json() as { data?: Member[] };
      setMembers(json.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="member-directory-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card skeleton" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="member-directory-grid">
      {members.map((m) => {
        const displayName = m.nickname ?? m.name;
        
        return (
          <Link className="member-directory-link" key={m.id} href={`/members/${m.id}`}>
            <div className={`card member-directory-card${m.status === "deactivated" ? " is-deactivated" : ""}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt={m.name} className="avatar avatar-lg" />
                ) : (
                  <div className="avatar-fallback avatar-lg" style={{ fontSize: "1.25rem" }}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1.0625rem", marginBottom: "0.125rem" }}>
                    {displayName}
                  </div>
                  <div className="text-secondary" style={{ fontSize: "0.8125rem", marginBottom: "0.375rem" }}>
                    {m.nickname ? m.name : "Member"}
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {m.role === "admin" && (
                      <span className="badge badge-primary" style={{ padding: "0.1rem 0.375rem", fontSize: "0.65rem" }}>
                        admin
                      </span>
                    )}
                    <span className={m.status === "active" ? "badge badge-success" : "badge badge-danger"} style={{ padding: "0.1rem 0.375rem", fontSize: "0.65rem" }}>
                      {m.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
