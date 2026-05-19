"use client";

import { useState, useEffect, useCallback } from "react";

interface FridgePayment {
  id: string;
  paidBy: { id: string; name: string; avatarUrl: string | null };
  amount: string;
  paidAt: string;
}

interface FridgeBill {
  id: string;
  month: string; // "YYYY-MM"
  previousReading: string;
  currentReading: string;
  unitPrice: string;
  totalAmount: string;
  perMemberAmount: string;
  memberCount: number;
  postedAt: string;
  isSettled: boolean;
  payments: FridgePayment[];
}

interface Props {
  previousMonthLabel: string;
  prevMonthKey: string; // "YYYY-MM"
  lastCurrentReading: string | null; // null = first ever bill
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
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Prev Reading</label>
            <input className="input" type="number" step="0.01" value={editPrev} onChange={(e) => setEditPrev(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Curr Reading</label>
            <input className="input" type="number" step="0.01" value={editCurr} onChange={(e) => setEditCurr(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Unit Price</label>
            <input className="input" type="number" step="0.0001" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
          </div>
        </div>

        {error && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{error}</div>}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button className="btn btn-sm btn-primary" onClick={() => void handleSave()} disabled={saving || !editCurr}>
            {saving ? <span className="spinner" /> : "Save & Recalculate"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.375rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
            ৳{parseFloat(bill.totalAmount).toLocaleString()}
          </span>
          {bill.isSettled && <span className="badge badge-muted">Settled</span>}
          {isAdmin && !bill.isSettled && (
            <button 
              className="btn btn-ghost" 
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: "0.25rem" }}
              onClick={() => setIsEditing(true)}
            >
              ✏️ Correct
            </button>
          )}
        </div>
        <span className="text-muted" style={{ fontSize: "0.8125rem", textAlign: "right" }}>
          {bill.memberCount} members · ৳{parseFloat(bill.perMemberAmount).toLocaleString()} each
        </span>
      </div>
      <div className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
        {parseFloat(bill.previousReading).toLocaleString()} → {parseFloat(bill.currentReading).toLocaleString()} units ({units} used · ৳{parseFloat(bill.unitPrice)} /unit)
      </div>
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
                {new Date(bill.month + "-01T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })}
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

export default function FridgeClient({ previousMonthLabel, prevMonthKey, lastCurrentReading, defaultUnitPrice, currentUserId, isAdmin, todayStr }: Props) {
  const [bills, setBills] = useState<FridgeBill[]>([]);
  const [loading, setLoading] = useState(true);

  // Post bill form
  const [previousReading, setPreviousReading] = useState(lastCurrentReading ?? "");
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
    const res = await fetch("/api/fridge");
    const json = await res.json() as { data?: FridgeBill[] };
    setBills(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitBill(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingBill(true);
    setBillError(null);
    setBillSuccess(false);
    try {
      const body: Record<string, unknown> = {
        currentReading: parseFloat(currentReading),
      };
      // Only send previousReading if it's the first bill (no lastCurrentReading from server)
      if (lastCurrentReading === null) {
        body.previousReading = parseFloat(previousReading);
      }
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
  const isFirstBill = lastCurrentReading === null;

  // Live calculation — depends on isFirstBill so must come after it
  const prev = isFirstBill ? parseFloat(previousReading) : parseFloat(lastCurrentReading ?? "0");
  const curr = parseFloat(currentReading);
  const price = parseFloat(defaultUnitPrice);
  const unitsConsumed = !isNaN(prev) && !isNaN(curr) && curr >= prev ? curr - prev : null;
  const computedTotal = unitsConsumed !== null && !isNaN(price) && price > 0
    ? (unitsConsumed * price).toFixed(2)
    : null;

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Fridge Bill</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
            Shared fridge electricity bill — split equally among all members active during the bill month
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Post bill form */}
          {!hasCurrentMonthBill && (
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
                    {isFirstBill
                      ? <span className="text-muted" style={{ fontWeight: 400, fontSize: "0.875rem" }}>—</span>
                      : `${parseFloat(lastCurrentReading!).toLocaleString()} units`}
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

                {/* First bill only: previous reading input */}
                {isFirstBill && (
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                      Previous Meter Reading (units)
                    </label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 1450"
                      value={previousReading}
                      onChange={(e) => setPreviousReading(e.target.value)}
                      required
                      style={{ maxWidth: 180 }}
                    />
                  </div>
                )}

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
                      ৳{parseFloat(computedTotal).toLocaleString()}
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
              ? new Date(currentBill.month + "-01T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })
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
                No fridge bills have been posted yet. Post last month&apos;s electricity bill above.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
