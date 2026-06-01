"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatTaka } from "@/lib/utils/decimal";
import { formatNumericDate, formatMonthLabel } from "@/lib/utils/dates";
import Decimal from "decimal.js";

interface BalanceEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  balance: string;
  breakdown: {
    bazarContributed: string;
    maidPayments: string;
    bulkPurchases: string;
    fridgePayments: string;
    mealCost: string;
    maidCharge: string;
    bulkAllocations: string;
    fridgeBillShare: string;
  };
}

interface HistoryMonth {
  month: string;
  settledAt: string;
  transfers: Array<{
    id: string;
    fromUser: { id: string; name: string };
    toUser: { id: string; name: string };
    amount: string;
  }>;
}

interface Props {
  isAdmin: boolean;
  monthName: string;
}

export default function SettlementClient({ isAdmin, monthName }: Props) {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [mealRate, setMealRate] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<HistoryMonth | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ type: string; message: string }>>([]);

  // Viewed month & current month states (format: YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [isSettled, setIsSettled] = useState<boolean>(false);

  const load = useCallback(async (monthToLoad?: string) => {
    setLoading(true);
    const query = monthToLoad ? `?month=${monthToLoad}` : "";
    const [balRes, histRes] = await Promise.all([
      fetch(`/api/settlement/balance${query}`),
      fetch("/api/settlement/history"),
    ]);
    
    const balJson = await balRes.json() as { 
      data?: { 
        balances: BalanceEntry[]; 
        mealRate: string | null;
        month: string;
        currentMonth: string;
        isSettled: boolean;
        validationErrors?: Array<{ type: string; message: string }>;
      } 
    };
    const histJson = await histRes.json() as { data?: HistoryMonth[] };
    
    setBalances(balJson.data?.balances ?? []);
    setMealRate(balJson.data?.mealRate ?? null);
    setIsSettled(balJson.data?.isSettled ?? false);
    setValidationErrors(balJson.data?.validationErrors ?? []);
    setHistory(histJson.data ?? []);
    
    if (balJson.data) {
      setSelectedMonth(balJson.data.month);
      setCurrentMonth(balJson.data.currentMonth);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function getPreviousMonthKey(monthKey: string): string {
    const [yearStr, monthStr] = monthKey.split("-");
    let y = parseInt(yearStr!);
    let m = parseInt(monthStr!) - 1;
    if (m === 0) {
      m = 12;
      y--;
    }
    return `${y}-${String(m).padStart(2, "0")}`;
  }

  const prevMonthKey = currentMonth ? getPreviousMonthKey(currentMonth) : "";
  const isPrevMonthSettled = history.some((h) => h.month === prevMonthKey);
  const showUnsettledBanner = prevMonthKey && !isPrevMonthSettled && selectedMonth === currentMonth;

  const handleMonthSwitch = (month: string) => {
    void load(month);
  };

  async function runSettlement() {
    if (!confirm(`Run month-end settlement for ${formatMonthLabel(selectedMonth)}? This is permanent and cannot be undone.`)) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/settlement/run", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const json = await res.json() as { error?: string; data?: { month: string; transfers: HistoryMonth["transfers"] } };
      if (!res.ok) {
        setRunError(json.error ?? "Failed to run settlement.");
      } else {
        setRunResult({ month: json.data!.month, settledAt: new Date().toISOString(), transfers: json.data!.transfers });
        void load(selectedMonth);
      }
    } catch {
      setRunError("Network error.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Settlement</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
            {formatMonthLabel(selectedMonth || currentMonth || monthName)}
            {mealRate && <> · Meal rate: <strong>৳{parseFloat(mealRate).toFixed(2)}/meal</strong></>}
          </p>
        </div>
        {isAdmin && !isSettled && (
          <button className="btn btn-primary" onClick={() => void runSettlement()} disabled={running || validationErrors.length > 0} style={{ height: "44px", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
            {running ? <><span className="spinner" /> Running...</> : "Run Settlement"}
          </button>
        )}
        {isSettled && (
          <span className="badge badge-success" style={{ fontSize: "0.875rem", padding: "0.5rem 1.0rem" }}>
            ✓ Settled
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {validationErrors.length > 0 && !isSettled && (
            <div style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--radius-lg)",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }} className="slide-up">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>⚠️</span>
                <span style={{ fontWeight: 600, color: "var(--color-danger)", fontSize: "0.9375rem" }}>Discrepancies Detected</span>
              </div>
              <p style={{ fontSize: "0.875rem", margin: 0, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
                Settlement cannot be run because the following transaction aggregates are unbalanced:
              </p>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                {validationErrors.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
              {validationErrors.some(e => e.type === "maid") && (
                <p style={{ fontSize: "0.8125rem", margin: "0.25rem 0 0", color: "var(--color-text-secondary)" }}>
                  💡 Tip: You can switch to the <strong>Maid tab</strong>, toggle to the <strong>Previous Month</strong>, and record the missing payment.
                </p>
              )}
            </div>
          )}

          {showUnsettledBanner && (
            <div style={{
              background: "var(--color-warning-bg)",
              border: "1px solid rgba(196, 154, 60, 0.3)",
              borderRadius: "var(--radius-lg)",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }} className="slide-up">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>⚠️</span>
                <span style={{ fontWeight: 600, color: "var(--color-warning)", fontSize: "0.9375rem" }}>Attention Required</span>
              </div>
              <p style={{ fontSize: "0.875rem", margin: 0, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
                The previous month (<strong>{formatMonthLabel(prevMonthKey)}</strong>) has passed but is not settled yet. 
                You must settle it before settling the current month.
              </p>
              <button 
                onClick={() => handleMonthSwitch(prevMonthKey)} 
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: "flex-start", marginTop: "0.25rem", height: "44px", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                View & Settle {formatMonthLabel(prevMonthKey)} &rarr;
              </button>
            </div>
          )}

          {selectedMonth !== currentMonth && (
            <div className="slide-up">
              <button 
                onClick={() => handleMonthSwitch(currentMonth)} 
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", height: "44px", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                &larr; Switch to Current Month ({formatMonthLabel(currentMonth)})
              </button>
            </div>
          )}

          {runError && <div style={{ background: "var(--color-danger-glow)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "var(--color-danger)", fontSize: "0.875rem" }}>{runError}</div>}

          {runResult && (
            <div style={{ background: "var(--color-success-glow)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-success)", marginBottom: "0.5rem" }}>Settlement complete for {runResult.month}!</div>
              {runResult.transfers.map((t) => (
                <div key={t.id} style={{ fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
                  {t.fromUser.name} → {t.toUser.name}: ৳{parseFloat(t.amount).toLocaleString()}
                </div>
              ))}
            </div>
          )}

          {/* Current Balances */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Current Balances</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {balances.map((b) => {
                const bal = new Decimal(b.balance);
                const isPos = bal.gte(0);
                const isExpanded = expandedUser === b.userId;
                return (
                  <div key={b.userId}>
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : b.userId)}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.75rem", borderRadius: "var(--radius-md)", background: isExpanded ? "var(--color-bg-elevated)" : "transparent", transition: "background 0.15s" }}>
                        {b.avatarUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={b.avatarUrl} alt={b.name} className="avatar avatar-sm" />
                          : <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{b.name.charAt(0)}</div>
                        }
                        <span style={{ flex: 1, fontWeight: 500, fontSize: "0.875rem" }}>{b.name}</span>
                        <span style={{ fontWeight: 700, color: isPos ? "var(--color-success)" : "var(--color-danger)" }}>
                          {isPos ? "+" : ""}{formatTaka(bal)}
                        </span>
                        <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ margin: "0.25rem 0 0.25rem 2.5rem", padding: "0.75rem", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)", fontSize: "0.8125rem" }} className="fade-in">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem" }}>
                          <span className="text-secondary">Bazar contributed:</span><span style={{ color: "var(--color-success)", textAlign: "right" }}>+৳{parseFloat(b.breakdown.bazarContributed).toLocaleString()}</span>
                          <span className="text-secondary">Maid payments:</span><span style={{ color: "var(--color-success)", textAlign: "right" }}>+৳{parseFloat(b.breakdown.maidPayments).toLocaleString()}</span>
                          <span className="text-secondary">Bulk purchases:</span><span style={{ color: "var(--color-success)", textAlign: "right" }}>+৳{parseFloat(b.breakdown.bulkPurchases).toLocaleString()}</span>
                          <span className="text-secondary">Fridge payments:</span><span style={{ color: "var(--color-success)", textAlign: "right" }}>+৳{parseFloat(b.breakdown.fridgePayments).toLocaleString()}</span>
                          <span className="text-secondary">Meal cost:</span><span style={{ color: "var(--color-danger)", textAlign: "right" }}>−৳{parseFloat(b.breakdown.mealCost).toLocaleString()}</span>
                          <span className="text-secondary">Maid charge:</span><span style={{ color: "var(--color-danger)", textAlign: "right" }}>−৳{parseFloat(b.breakdown.maidCharge).toLocaleString()}</span>
                          <span className="text-secondary">Bulk allocations:</span><span style={{ color: "var(--color-danger)", textAlign: "right" }}>−৳{parseFloat(b.breakdown.bulkAllocations).toLocaleString()}</span>
                          <span className="text-secondary">Fridge share:</span><span style={{ color: "var(--color-danger)", textAlign: "right" }}>−৳{parseFloat(b.breakdown.fridgeBillShare).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settlement history */}
          {history.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Settlement History</div>
              {history.map((h) => (
                <div key={h.month} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <Link 
                      href={`/settlement/${h.month}`}
                      style={{ fontWeight: 600, textDecoration: "none", color: "var(--color-primary-light)" }}
                      className="hover-underline"
                    >
                      {formatMonthLabel(h.month)}
                      <span style={{ fontSize: "0.75rem", marginLeft: "0.5rem" }}>→ View Details</span>
                    </Link>
                    <span className="badge badge-muted" style={{ fontWeight: 400 }}>
                      Settled {formatNumericDate(h.settledAt)}
                    </span>
                  </div>
                  {h.transfers.map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>
                      <span>{t.fromUser.name}</span>
                      <span style={{ color: "var(--color-primary-light)" }}>→</span>
                      <span>{t.toUser.name}</span>
                      <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--color-text-primary)" }}>৳{parseFloat(t.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
