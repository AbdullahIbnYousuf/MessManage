"use client";

import { useState, useEffect, useCallback } from "react";
import { formatMonthLabel } from "@/lib/utils/dates";

interface ChargeEntry {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  amount: string;
  appliedAt: string;
}

interface Payment {
  id: string;
  amount: string;
  month: string;
  note: string | null;
  paidAt: string;
  paidBy: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  isAdmin: boolean;
  currentUserId: string;
  currentMonthKey: string;
  defaultCharge: string;
  todayStr: string;
}

function MaidPaymentRow({
  payment: p,
  isLast,
  canEdit,
  onSaveEdit,
}: {
  payment: Payment;
  isLast: boolean;
  canEdit: boolean;
  onSaveEdit: (id: string, amount: string, note: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editAmt, setEditAmt] = useState(p.amount);
  const [editNote, setEditNote] = useState(p.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasNote = !!p.note;
  const monthLabel = formatMonthLabel(p.month);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSaveEdit(p.id, editAmt, editNote);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update payment.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div
        className="fade-in"
        style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-md)",
          padding: "0.875rem",
          marginBottom: isLast ? 0 : "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
          Edit Payment ({p.paidBy.name})
        </div>
        <input
          className="input"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Amount (৳)"
          value={editAmt}
          onChange={(e) => setEditAmt(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="Note (optional)"
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
        />
        {error && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{error}</div>}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-sm btn-primary" onClick={() => void handleSave()} disabled={saving || !editAmt}>
            {saving ? <span className="spinner" /> : "Save"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => hasNote && setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem 0",
          borderBottom: isLast && !expanded ? "none" : "1px solid var(--color-border-subtle)",
          cursor: hasNote ? "pointer" : "default",
        }}
      >
        {p.paidBy.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={p.paidBy.avatarUrl} alt={p.paidBy.name} className="avatar avatar-sm" />
          : <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{p.paidBy.name.charAt(0)}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{p.paidBy.name}</div>
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>{monthLabel}</div>
        </div>
        
        {canEdit && (
          <button 
            className="btn btn-ghost" 
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            ✏️ Edit
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: "var(--color-success)", fontSize: "0.9375rem" }}>
            +৳{parseFloat(p.amount).toLocaleString()}
          </span>
          {hasNote && (
            <span style={{ fontSize: "1rem", color: expanded ? "var(--color-text-secondary)" : "var(--color-text-muted)", lineHeight: 1, userSelect: "none" }}>
              {expanded ? "×" : "≡"}
            </span>
          )}
        </div>
      </div>
      {expanded && p.note && (
        <div style={{
          padding: "0.5rem 0.75rem 0.625rem 2.75rem",
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-elevated)",
          borderRadius: "0 0 var(--radius-md) var(--radius-md)",
          whiteSpace: "pre-wrap",
        }}>
          {p.note}
        </div>
      )}
    </div>
  );
}

export default function MaidClient({ isAdmin, currentUserId, currentMonthKey, defaultCharge, todayStr }: Props) {
  const [charges, setCharges] = useState<ChargeEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  // Admin: apply charges
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [pastPaymentsExpanded, setPastPaymentsExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [chargesRes, paymentsRes] = await Promise.all([
      fetch("/api/maid/charges"),
      fetch("/api/maid/payment"),
    ]);
    const chargesJson = await chargesRes.json() as { data?: { charges: ChargeEntry[]; defaultCharge: string } };
    const paymentsJson = await paymentsRes.json() as { data?: Payment[] };
    setCharges(chargesJson.data?.charges ?? []);
    setPayments(paymentsJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setPayError(null);
    setPaySuccess(false);
    try {
      const res = await fetch("/api/maid/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(payAmount), note: payNote }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setPayError(json.error ?? "Failed to record payment.");
      } else {
        setPayAmount("");
        setPayNote("");
        setPaySuccess(true);
        void load();
      }
    } catch {
      setPayError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(id: string, amount: string, note: string) {
    const res = await fetch(`/api/maid/payment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(amount), note }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to update payment.");
    }
    void load();
  }

  async function applyCharges() {
    setApplying(true);
    setApplyError(null);
    setApplySuccess(false);
    try {
      const res = await fetch("/api/admin/maid", { method: "POST" });
      const json = await res.json() as { error?: string; data?: { applied: number } };
      if (!res.ok) {
        setApplyError(json.error ?? "Failed to apply charges.");
      } else {
        setApplySuccess(true);
        void load();
      }
    } catch {
      setApplyError("Network error.");
    } finally {
      setApplying(false);
    }
  }

  const monthLabel = formatMonthLabel(currentMonthKey);
  const chargesApplied = charges.length > 0;

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Maid</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
            Monthly maid charges and payments — {monthLabel}
          </p>
        </div>
        {isAdmin && !chargesApplied && (
          <button className="btn btn-primary" onClick={() => void applyCharges()} disabled={applying}>
            {applying ? <span className="spinner" /> : `Apply ৳${defaultCharge} Charge to All`}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Admin apply error/success */}
          {applyError && <div style={{ background: "var(--color-danger-glow)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "var(--color-danger)", fontSize: "0.875rem" }}>{applyError}</div>}
          {applySuccess && <div style={{ background: "var(--color-success-glow)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "var(--color-success)", fontSize: "0.875rem" }}>Maid charges applied successfully!</div>}

          {/* Current month charges */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.875rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Charges This Month</span>
              {chargesApplied
                ? <span className="badge badge-success">Applied</span>
                : <span className="badge badge-warning">Not Applied Yet</span>}
            </div>

            {chargesApplied ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {charges.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    {c.userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.userAvatar} alt={c.userName} className="avatar avatar-sm" />
                    ) : (
                      <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{c.userName.charAt(0)}</div>
                    )}
                    <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500 }}>{c.userName}</span>
                    <span style={{ fontWeight: 700, color: "var(--color-danger)" }}>−৳{parseFloat(c.amount).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ paddingTop: "0.5rem", fontWeight: 700, textAlign: "right", color: "var(--color-text-primary)" }}>
                  Total: ৳{charges.reduce((s, c) => s + parseFloat(c.amount), 0).toLocaleString()}
                </div>
              </div>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
                {isAdmin
                  ? `No maid charges applied yet for ${monthLabel}. Use the button above to apply ৳${defaultCharge} to each active member.`
                  : `No maid charges have been applied yet for ${monthLabel}.`}
              </p>
            )}
          </div>

          {/* Record payment form */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Record Maid Payment</div>
            <p className="text-secondary" style={{ fontSize: "0.8125rem", marginBottom: "1rem" }}>
              If you paid the maid on behalf of the whole group, record it here. You will receive the full amount as a credit.
            </p>
            
            <div style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: "var(--radius-md)",
              padding: "0.625rem 0.75rem",
              fontSize: "0.8125rem",
              color: "var(--color-warning)",
              marginBottom: "1rem",
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-start",
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span><strong>Make sure the amount is correct.</strong> You can only edit this payment <strong>today</strong> after submitting. After midnight it cannot be changed.</span>
            </div>

            <form onSubmit={(e) => void submitPayment(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>Amount paid (৳)</label>
                <input className="input" type="number" min="0.01" step="0.01" placeholder="e.g. 3500" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>Note (optional)</label>
                <input className="input" type="text" placeholder="e.g. Paid for May" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
              {payError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{payError}</div>}
              {paySuccess && <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Payment recorded!</span>}
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
                {submitting ? <span className="spinner" /> : "Record Payment"}
              </button>
            </form>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (() => {
            const currentMonth = currentMonthKey.slice(0, 7);
            const monthLabel = formatMonthLabel(currentMonthKey);
            const thisMonth = payments.filter((p) => p.month.startsWith(currentMonth));
            const past = payments.filter((p) => !p.month.startsWith(currentMonth));
            return (
              <>
                {thisMonth.length > 0 && (
                  <div className="card">
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.875rem" }}>
                      {monthLabel} Payments
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {thisMonth.map((p, i) => {
                        const canEdit = isAdmin || (p.paidBy.id === currentUserId && p.paidAt.startsWith(todayStr));
                        return (
                          <MaidPaymentRow key={p.id} payment={p} isLast={i === thisMonth.length - 1} canEdit={canEdit} onSaveEdit={handleSaveEdit} />
                        );
                      })}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div className="card">
                    <button
                      onClick={() => setPastPaymentsExpanded((v) => !v)}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Past Payments</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        {past.length} entries
                        <span style={{ transition: "transform 0.2s", display: "inline-block", transform: pastPaymentsExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                      </span>
                    </button>
                    {pastPaymentsExpanded && (
                      <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column" }} className="fade-in">
                        {past.map((p, i) => {
                          const canEdit = isAdmin || (p.paidBy.id === currentUserId && p.paidAt.startsWith(todayStr));
                          return (
                            <MaidPaymentRow key={p.id} payment={p} isLast={i === past.length - 1} canEdit={canEdit} onSaveEdit={handleSaveEdit} />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
