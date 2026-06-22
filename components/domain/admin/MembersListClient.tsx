"use client";

import { useState, useCallback, useEffect } from "react";
import MemberRow from "@/components/domain/admin/MemberRow";

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
  currentUserId: string;
}

export default function MembersListClient({ currentUserId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/members");
    const json = await res.json() as { data?: Member[] };
    setMembers(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: "1rem",
      }}
    >
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          currentUserId={currentUserId}
          onDeactivated={load}
        />
      ))}
    </div>
  );
}
