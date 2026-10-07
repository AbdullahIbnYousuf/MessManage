"use client";

import { useEffect, useState } from "react";
import type { ActingSessionView } from "@/types/acting";
import { memberFetch, returnToAccountScreen, stopMemberRequests } from "@/lib/utils/member-fetch";

export default function ActingBanner({ acting, error }: { acting: ActingSessionView | null; error: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === "mm-account-change") { stopMemberRequests(); window.location.reload(); }
    };
    window.addEventListener("storage", changed);
    const onFocus = () => {
      void memberFetch("/api/admin/acting-as").then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { data: { contextId: string; error: unknown } };
        if (payload.data.contextId !== (acting?.id ?? "self") || Boolean(payload.data.error) !== Boolean(error)) {
          stopMemberRequests(); window.location.reload();
        }
      }).catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    const timeout = acting ? setTimeout(() => setMessage("Acting access has expired. Return to your account before continuing."), Math.max(0, new Date(acting.expiresAt).getTime() - Date.now())) : undefined;
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("focus", onFocus); if (timeout) clearTimeout(timeout); };
  }, [acting, error]);

  async function leave() {
    setBusy(true);
    try {
      const response = await memberFetch("/api/admin/acting-as", { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not return to your account.");
      returnToAccountScreen("/admin/members");
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Please retry."); setBusy(false); }
  }
  if (!acting && !error) return null;
  return <section className="acting-banner" aria-label="Acting account" role="status">
    <div><strong>{acting ? `Acting as ${acting.member.nickname || acting.member.name}` : "Acting access unavailable"}</strong>
      <span>{acting ? `Admin: ${acting.admin.nickname || acting.admin.name} · All changes are audited.` : "Your admin login is unchanged."}</span>
      {message && <span className="text-negative">{message}</span>}
    </div>
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void leave()}>{busy ? "Returning…" : "Return to admin"}</button>
  </section>;
}
