"use client";

import { memberFetch as fetch } from "@/lib/utils/member-fetch";

import { useState, useEffect, useCallback } from "react";
import { formatMonthLabel } from "@/lib/utils/dates";
import ExpensesBackLink from "@/components/domain/expenses/ExpensesBackLink";
import { PageHeader } from "@/components/ui/Editorial";
import Decimal from "decimal.js";
import { computeTotalFromReadings } from "@/lib/domain/fridge";

interface FridgePayment {
  id: string;
  paidBy: { id: string; name: string; avatarUrl: string | null };
  amount: string;
  paidAt: string;
}

interface FridgeAllocation {
  user: { id: string; name: string; avatarUrl: string | null };
  amount: string;
}

interface FridgeBill {
  id: string;
  month: string; // "YYYY-MM"
  previousReading: string;
  currentReading: string;
  unitPrice: string;
  totalAmount: string;
  memberCount: number;
  shareRange: { min: string; max: string } | null;
  allocations: FridgeAllocation[];
  postedAt: string;
  isSettled: boolean;
  payments: FridgePayment[];
}

interface Props {
  previousMonthLabel: string;
  prevMonthKey: string; // "YYYY-MM"
  lastCurrentReading: string | null; // null = first ever bill
  initialReading: string | null;
  initialMonth: string | null;
  defaultUnitPrice: string;
  currentUserId: string;
  isAdmin: boolean;
  todayStr: string;
}

function BillRow({
  bill,
  isAdmin,
  onSaveEdit,
}: {
  bill: FridgeBill;
  isAdmin: boolean;
  onSaveEdit: (month: string, prevRd: string, currRd: string, unitPr: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPrev, setEditPrev] = useState(bill.previousReading);
  const [editCurr, setEditCurr] = useState(bill.currentReading);
  const [editPrice, setEditPrice] = useState(bill.unitPrice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllocations, setShowAllocations] = useState(false);

  const units = (parseFloat(bill.currentReading) - parseFloat(bill.previousReading)).toLocaleString();

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSaveEdit(bill.month, editPrev, editCurr, editPrice);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to correct bill.");
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
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          border: "1px solid var(--color-border-subtle)",
          marginBottom: "0.5rem"
        }}
      >
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
          Correct Bill
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div style={{ minWidth: 0 }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Prev Reading</label>
            <input className="input" type="number" step="0.01" value={editPrev} onChange={(e) => setEditPrev(e.target.value)} />
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Curr Reading</label>
            <input className="input" type="number" step="0.01" value={editCurr} onChange={(e) => setEditCurr(e.target.value)} />
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Unit Price</label>
            <input className="input" type="number" step="0.0001" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
          </div>
        </div>

        {error && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44, flex: "1 1 10rem", touchAction: "manipulation" }} onClick={() => void handleSave()} disabled={saving || !editCurr}>
            {saving ? <span className="spinner" /> : "Save & Recalculate"}
          </button>
          <button className="btn btn-sm btn-ghost" style={{ minHeight: 44, flex: "1 1 6rem", touchAction: "manipulation" }} onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.375rem" }}>
        <div style={{ minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
            ৳{parseFloat(bill.totalAmount).toLocaleString()}
          </span>
          {bill.isSettled && <span className="badge badge-muted">Settled</span>}
          {isAdmin && !bill.isSettled && (
            <button 
              className="btn btn-ghost" 
              style={{ minHeight: 44, padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--color-text-muted)", marginLeft: "0.25rem", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              onClick={() => setIsEditing(true)}
            >
              ✏️ Correct
            </button>
          )}
        </div>
        <span className="text-muted" style={{ marginLeft: "auto", fontSize: "0.8125rem", textAlign: "right" }}>
          {bill.memberCount} members
          {bill.shareRange && (
            <> · ৳{parseFloat(bill.shareRange.min).toLocaleString()}{bill.shareRange.min !== bill.shareRange.max ? `–৳${parseFloat(bill.shareRange.max).toLocaleString()}` : ""} each</>
          )}
        </span>
      </div>
      <div className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
        {parseFloat(bill.previousReading).toLocaleString()} → {parseFloat(bill.currentReading).toLocaleString()} units ({units} used · ৳{parseFloat(bill.unitPrice)} /unit)
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setShowAllocations((visible) => !visible)}
        aria-expanded={showAllocations}
        style={{
          width: "100%",
          minHeight: 44,
          justifyContent: "space-between",
          padding: "0.625rem 0.75rem",
          fontSize: "0.875rem",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span>Charged members</span>
        <span aria-hidden="true">{showAllocations ? "▴" : "▾"}</span>
      </button>
      {showAllocations && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", paddingTop: "0.5rem" }}>
          {bill.allocations.map((allocation) => (
            <div
              key={allocation.user.id}
              style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.625rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg-elevated)",
              }}
            >
              {allocation.user.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={allocation.user.avatarUrl} alt="" className="avatar avatar-sm" />
                : <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem", flexShrink: 0 }}>{allocation.user.name.charAt(0)}</div>
              }
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.875rem" }}>
                {allocation.user.name}
              </span>
              <span style={{ flexShrink: 0, fontSize: "0.875rem", fontWeight: 700 }}>
                ৳{parseFloat(allocation.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FridgePaymentRow({
  payment: p,
  isLast,
  canEdit,
  onSaveEdit,
}: {
  payment: FridgePayment;
  isLast: boolean;
  canEdit: boolean;
  onSaveEdit: (id: string, amount: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmt, setEditAmt] = useState(p.amount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSaveEdit(p.id, editAmt);
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
          padding: "0.75rem",
          marginBottom: isLast ? 0 : "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
          Edit Payment
        </div>
        <input
          className="input"
          type="number"
          min="0.01"
          step="0.01"
          value={editAmt}
          onChange={(e) => setEditAmt(e.target.value)}
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
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.375rem 0", borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)" }}>
      {p.paidBy.avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.paidBy.avatarUrl} alt={p.paidBy.name} className="avatar avatar-sm" />
        : <div className="avatar-fallback" style={{ width: 26, height: 26, fontSize: "0.6875rem" }}>{p.paidBy.name.charAt(0)}</div>
      }
      <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500 }}>{p.paidBy.name}</span>
      
      {canEdit && (
        <button 
          className="btn btn-ghost" 
          style={{ padding: "0.125rem 0.375rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}
          onClick={() => setIsEditing(true)}
        >
          ✏️ Edit
        </button>
      )}

      <span style={{ fontWeight: 700, color: "var(--color-success)" }}>+৳{parseFloat(p.amount).toLocaleString()}</span>
    </div>
  );
}

function PastBillsCard({ bills, isAdmin, onSaveBillEdit, currentUserId, todayStr, onSavePaymentEdit }: { 
  bills: FridgeBill[]; 
  isAdmin: boolean;
  onSaveBillEdit: (month: string, prevRd: string, currRd: string, unitPr: string) => Promise<void>;
  currentUserId: string;
  todayStr: string;
  onSavePaymentEdit: (id: string, amount: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card">
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Past Bills</span>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {bills.length} {bills.length === 1 ? "bill" : "bills"}
          <span style={{ transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "1.25rem" }} className="fade-in">
          {bills.map((bill) => (
            <div key={bill.id}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.5rem", color: "var(--color-text-secondary)" }}>
                {formatMonthLabel(bill.month)}
              </div>
              <BillRow bill={bill} isAdmin={isAdmin} onSaveEdit={onSaveBillEdit} />
              
              {bill.payments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.5rem" }}>
                  {bill.payments.map((p, i) => {
                    const canEdit = isAdmin || (p.paidBy.id === currentUserId && p.paidAt.startsWith(todayStr));
                    return (
                      <FridgePaymentRow 
                        key={p.id} 
                        payment={p} 
                        isLast={i === bill.payments.length - 1} 
                        canEdit={canEdit}
                        onSaveEdit={onSavePaymentEdit}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>No payments recorded yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FridgeClient({ previousMonthLabel, prevMonthKey, lastCurrentReading, initialReading, initialMonth, defaultUnitPrice, currentUserId, isAdmin, todayStr }: Props) {
  const [bills, setBills] = useState<FridgeBill[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial setup records a baseline only, never a bill.
  const [baseline, setBaseline] = useState<{ reading: string; month: string } | null>(
    initialReading !== null && initialMonth !== null ? { reading: initialReading, month: initialMonth } : null
  );
  const [initialInput, setInitialInput] = useState("");
  const [savingInitial, setSavingInitial] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Post bill form
  const [currentReading, setCurrentReading] = useState("");
  const [submittingBill, setSubmittingBill] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [billSuccess, setBillSuccess] = useState(false);

  // Record payment form
  const [payAmount, setPayAmount] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/fridge");
      const json = await res.json() as { data?: FridgeBill[]; error?: string };
      if (!res.ok || !Array.isArray(json.data)) throw new Error(json.error ?? "Could not load fridge bills.");
      setBills(json.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load fridge bills.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitInitialReading(e: React.FormEvent) {
    e.preventDefault();
    setSavingInitial(true);
    setInitialError(null);
    try {
      const res = await fetch("/api/fridge/initial-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading: initialInput }),
      });
      const json = await res.json() as { data?: { reading: string; month: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Could not save the initial reading.");
      setBaseline(json.data);
      setInitialInput("");
    } catch (error) {
      setInitialError(error instanceof Error ? error.message : "Could not save the initial reading. Please retry.");
    } finally { setSavingInitial(false); }
  }

  async function submitBill(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingBill(true);
    setBillError(null);
    setBillSuccess(false);
    try {
      const body: Record<string, unknown> = {
        currentReading,
      };
      const res = await fetch("/api/fridge/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setBillError(json.error ?? "Failed to post bill.");
      } else {
        setCurrentReading("");
        setBillSuccess(true);
        void load();
      }
    } catch {
      setBillError("Network error.");
    } finally {
      setSubmittingBill(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingPay(true);
    setPayError(null);
    setPaySuccess(false);
    try {
      const res = await fetch("/api/fridge/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(payAmount), month: prevMonthKey + "-01" }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setPayError(json.error ?? "Failed to record payment.");
      } else {
        setPayAmount("");
        setPaySuccess(true);
        void load();
      }
    } catch {
      setPayError("Network error.");
    } finally {
      setSubmittingPay(false);
    }
  }

  async function handleSaveBillEdit(month: string, prevRd: string, currRd: string, unitPr: string) {
    const res = await fetch(`/api/fridge/bill/${month}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousReading: parseFloat(prevRd), currentReading: parseFloat(currRd), unitPrice: parseFloat(unitPr) }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to correct bill.");
    }
    void load();
  }

  async function handleSavePaymentEdit(id: string, amount: string) {
    const res = await fetch(`/api/fridge/payment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(amount) }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to update payment.");
    }
    void load();
  }

  const hasCurrentMonthBill = bills.some((b) => b.month === prevMonthKey);
  const currentMonthBill = bills.find((b) => b.month === prevMonthKey) ?? null;
  const isCurrentMonthSettled = currentMonthBill?.isSettled ?? false;
  const savedPreviousReading = bills[0]?.currentReading ?? lastCurrentReading ?? baseline?.reading ?? null;
  const needsInitialReading = savedPreviousReading === null;
  const waitingForFirstMonth = baseline !== null && prevMonthKey < baseline.month;
  let unitsConsumed: string | null = null;
  let computedTotal: string | null = null;
  if (savedPreviousReading !== null && currentReading !== "") {
    try {
      const prev = new Decimal(savedPreviousReading);
      const curr = new Decimal(currentReading);
      const price = new Decimal(defaultUnitPrice);
      if (curr.isFinite() && prev.isFinite() && price.isFinite() && curr.gte(prev) && price.gt(0)) {
        unitsConsumed = curr.sub(prev).toFixed(2);
        computedTotal = computeTotalFromReadings(prev, curr, price)?.toFixed(2) ?? null;
      }
    } catch { /* Incomplete numeric input has no bill preview. */ }
  }

  return (
    <div className="page-container">
      <ExpensesBackLink />
      <PageHeader
        eyebrow="Expenses"
        title="Fridge bill"
        description="Shared electricity, allocated across everyone active during the billing month."
      />

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : loadError ? (
        <div className="card" role="alert">
          <p className="text-negative">{loadError}</p>
          <button type="button" className="btn btn-secondary mt-3 min-h-11" onClick={() => void load()}>Retry</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {needsInitialReading && (
            <section className="card" aria-labelledby="initial-reading-title">
              <h2 id="initial-reading-title" className="text-xl">Initial meter reading</h2>
              <p className="text-secondary mt-2 mb-4">
                Save the starting reading for {formatMonthLabel(todayStr)}. This does not create a bill or charge anyone.
                Add the next reading after the month ends.
              </p>
              {isAdmin ? (
                <form onSubmit={(e) => void submitInitialReading(e)} className="flex flex-col gap-3">
                  <label htmlFor="fridge-initial-reading">Starting reading (units)</label>
                  <input id="fridge-initial-reading" className="input min-h-11 w-full" type="number" inputMode="decimal"
                    min="0" max="99999999.99" step="0.01" required placeholder="Enter meter reading"
                    value={initialInput} onChange={(e) => setInitialInput(e.target.value)} disabled={savingInitial}
                    aria-describedby="initial-reading-help" />
                  <p id="initial-reading-help" className="text-secondary text-sm">Check the meter before saving. This is a one-time setup.</p>
                  {initialError && <p role="alert" className="text-negative">{initialError}</p>}
                  <button className="btn btn-primary min-h-11 w-full" type="submit" disabled={savingInitial}>
                    {savingInitial ? "Saving…" : "Save initial reading"}
                  </button>
                </form>
              ) : <p className="text-secondary">Ask an admin to save the starting reading.</p>}
            </section>
          )}

          {baseline && (
            <section className="card" aria-label="Initial meter reading">
              <div className="stat-label">Initial reading · {formatMonthLabel(baseline.month)}</div>
              <p className="stat-value mt-2">{baseline.reading} <span className="text-base">units</span></p>
              <p className="text-secondary mt-2">
                Starting reading only. No bill or charges created.
                {waitingForFirstMonth && ` Add the next reading after ${formatMonthLabel(baseline.month)} ends.`}
              </p>
            </section>
          )}

          {/* Post bill form */}
          {!hasCurrentMonthBill && !needsInitialReading && !waitingForFirstMonth && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
                Post {previousMonthLabel} Bill
              </div>
              
              <div style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "var(--radius-md)",
                padding: "0.625rem 0.75rem",
                fontSize: "0.8125rem",
                color: "var(--color-warning)",
                marginTop: "1rem",
                marginBottom: "1.25rem",
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-start",
              }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span><strong>This bill will be split across all members. There is no edit after posting.</strong> Double-check your meter readings and unit price before submitting.</span>
              </div>

              {/* Quiet context row */}
              <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem" }}>
                <div>
                  <div className="stat-label">Previous Reading</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {savedPreviousReading} units
                  </div>
                </div>
                <div>
                  <div className="stat-label">Unit Price</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    ৳{parseFloat(defaultUnitPrice).toLocaleString()} / unit
                  </div>
                </div>
              </div>

              <form onSubmit={(e) => void submitBill(e)} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

                {/* Current reading — the hero */}
                <div>
                  <label style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                    Current Meter Reading (units)
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1520"
                    value={currentReading}
                    onChange={(e) => setCurrentReading(e.target.value)}
                    required
                    style={{ fontSize: "1.125rem", fontWeight: 600, maxWidth: 200 }}
                    autoFocus
                  />
                </div>

                {/* Live result — only show when computable */}
                {computedTotal !== null && (
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>
                    {unitsConsumed?.toLocaleString()} units used &nbsp;·&nbsp;
                    <strong style={{ color: "var(--color-text-primary)", fontSize: "0.9375rem" }}>
                      ৳{computedTotal}
                    </strong> total
                  </div>
                )}

                {billError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{billError}</div>}
                {billSuccess && <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Bill posted!</span>}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingBill || computedTotal === null}
                  style={{ alignSelf: "flex-start" }}
                >
                  {submittingBill ? <span className="spinner" /> : "Post Bill"}
                </button>
              </form>
            </div>
          )}

          {hasCurrentMonthBill && (
            <div style={{ background: "var(--color-success-glow)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "var(--color-success)", fontSize: "0.875rem" }}>
              ✓ {previousMonthLabel} bill has already been posted.
            </div>
          )}

          {/* Record payment form */}
          {hasCurrentMonthBill && !isCurrentMonthSettled && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Record Fridge Payment</div>
              <p className="text-secondary" style={{ fontSize: "0.8125rem", marginBottom: "1rem" }}>
                If you paid the fridge electricity bill on behalf of the group, record it here. You will receive the full amount as a credit.
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
                <span><strong>Verify the amount before you submit.</strong> You can only edit this payment <strong>today</strong>. After midnight it is permanent.</span>
              </div>

              <form onSubmit={(e) => void submitPayment(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                    Amount paid (৳)
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={`e.g. ${currentMonthBill?.totalAmount ?? "450"}`}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>
                {payError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{payError}</div>}
                {paySuccess && <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Payment recorded!</span>}
                <button type="submit" className="btn btn-primary" disabled={submittingPay} style={{ alignSelf: "flex-start" }}>
                  {submittingPay ? <span className="spinner" /> : "Record Payment"}
                </button>
              </form>
            </div>
          )}

          {/* Bill history — split into current month and past */}
          {bills.length > 0 && (() => {
            const currentBill = bills.find((b) => b.month === prevMonthKey) ?? null;
            const pastBills = bills.filter((b) => b.month !== prevMonthKey);
            const currentMonthLabel = currentBill
              ? formatMonthLabel(currentBill.month)
              : null;
            return (
              <>
                {currentBill && (
                  <div className="card">
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.875rem" }}>
                      {currentMonthLabel} Bill
                    </div>
                    <BillRow bill={currentBill} isAdmin={isAdmin} onSaveEdit={handleSaveBillEdit} />
                    
                    {currentBill.payments.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.5rem" }}>
                        {currentBill.payments.map((p, i) => {
                          const canEdit = isAdmin || (p.paidBy.id === currentUserId && p.paidAt.startsWith(todayStr));
                          return (
                            <FridgePaymentRow 
                              key={p.id} 
                              payment={p} 
                              isLast={i === currentBill.payments.length - 1} 
                              canEdit={canEdit}
                              onSaveEdit={handleSavePaymentEdit}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>No payments recorded yet.</p>
                    )}
                  </div>
                )}
                {pastBills.length > 0 && (
                  <PastBillsCard 
                    bills={pastBills} 
                    isAdmin={isAdmin} 
                    onSaveBillEdit={handleSaveBillEdit}
                    currentUserId={currentUserId}
                    todayStr={todayStr}
                    onSavePaymentEdit={handleSavePaymentEdit}
                  />
                )}
              </>
            );
          })()}

          {bills.length === 0 && (
            <div className="card">
              <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
                No fridge bills have been posted yet. {needsInitialReading
                  ? "Save an initial reading to start tracking."
                  : waitingForFirstMonth
                    ? "Your starting reading is saved; add the next reading after the month ends."
                    : "Post last month's electricity bill above."}
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
