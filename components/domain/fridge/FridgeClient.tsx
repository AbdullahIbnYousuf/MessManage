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
  totalAmount: string;
  perMemberAmount: string;
  memberCount: number;
  postedAt: string;
  payments: FridgePayment[];
}

interface Props {
  previousMonthLabel: string;
}

export default function FridgeClient({ previousMonthLabel }: Props) {
  const [bills, setBills] = useState<FridgeBill[]>([]);
  const [loading, setLoading] = useState(true);

  // Post bill form
  const [billAmount, setBillAmount] = useState("");
  const [submittingBill, setSubmittingBill] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [billSuccess, setBillSuccess] = useState(false);

  // Pay form (per bill)
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
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
      const res = await fetch("/api/fridge/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalAmount: parseFloat(billAmount) }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setBillError(json.error ?? "Failed to post bill.");
      } else {
        setBillAmount("");
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
    if (!payingBillId) return;
    setSubmittingPay(true);
    setPayError(null);
    setPaySuccess(false);
    try {
      const res = await fetch("/api/fridge/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: payingBillId, amount: parseFloat(payAmount) }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setPayError(json.error ?? "Failed to record payment.");
      } else {
        setPayAmount("");
        setPayingBillId(null);
        setPaySuccess(true);
        void load();
      }
    } catch {
      setPayError("Network error.");
    } finally {
      setSubmittingPay(false);
    }
  }

  const lastMonthKey = new Date();
  lastMonthKey.setMonth(lastMonthKey.getMonth() - 1);
  const prevMonthStr = `${lastMonthKey.getFullYear()}-${String(lastMonthKey.getMonth() + 1).padStart(2, "0")}`;
  const hasCurrentMonthBill = bills.some((b) => b.month === prevMonthStr);

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

          {/* Post a bill for previous month */}
          {!hasCurrentMonthBill && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
                Post {previousMonthLabel} Electricity Bill
              </div>
              <p className="text-secondary" style={{ fontSize: "0.8125rem", marginBottom: "1rem" }}>
                Enter the total fridge electricity bill for {previousMonthLabel}. It will be split equally among all eligible members.
              </p>
              <form onSubmit={(e) => void submitBill(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                    Total Bill Amount (৳)
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 450"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    required
                    style={{ maxWidth: 240 }}
                  />
                </div>
                {billError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{billError}</div>}
                {billSuccess && <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Bill posted!</span>}
                <button type="submit" className="btn btn-primary" disabled={submittingBill} style={{ alignSelf: "flex-start" }}>
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

          {/* Bill history */}
          {bills.length === 0 ? (
            <div className="card">
              <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
                No fridge bills have been posted yet. Post last month&apos;s electricity bill above.
              </p>
            </div>
          ) : (
            bills.map((bill) => (
              <div key={bill.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {new Date(bill.month + "-01T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })}
                    </div>
                    <div className="text-secondary" style={{ fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                      {bill.memberCount} members · ৳{parseFloat(bill.perMemberAmount).toLocaleString()} each
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--color-primary-light)" }}>
                      ৳{parseFloat(bill.totalAmount).toLocaleString()}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>total bill</div>
                  </div>
                </div>

                {/* Payments for this bill */}
                {bill.payments.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "0.75rem", marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-secondary)" }}>
                      Payments
                    </div>
                    {bill.payments.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.375rem 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        {p.paidBy.avatarUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.paidBy.avatarUrl} alt={p.paidBy.name} className="avatar avatar-sm" />
                          : <div className="avatar-fallback" style={{ width: 26, height: 26, fontSize: "0.6875rem" }}>{p.paidBy.name.charAt(0)}</div>
                        }
                        <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500 }}>{p.paidBy.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--color-success)" }}>+৳{parseFloat(p.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Record payment for this bill */}
                {payingBillId === bill.id ? (
                  <form onSubmit={(e) => void submitPayment(e)} style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Record Payment</div>
                    <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                          Amount paid (৳)
                        </label>
                        <input
                          className="input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder={bill.totalAmount}
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={submittingPay}>
                        {submittingPay ? <span className="spinner" /> : "Save"}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => { setPayingBillId(null); setPayAmount(""); setPayError(null); }}>
                        Cancel
                      </button>
                    </div>
                    {payError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{payError}</div>}
                  </form>
                ) : (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => { setPayingBillId(bill.id); setPaySuccess(false); setPayError(null); }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    + Record Payment
                  </button>
                )}
              </div>
            ))
          )}

          {paySuccess && (
            <div style={{ background: "var(--color-success-glow)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "var(--color-success)", fontSize: "0.875rem" }}>
              Payment recorded successfully!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
