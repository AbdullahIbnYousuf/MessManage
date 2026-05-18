"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatTaka } from "@/lib/utils/decimal";
import { formatNumericDate } from "@/lib/utils/dates";
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

  const load = useCallback(async () => {
    setLoading(true);
    const [balRes, histRes] = await Promise.all([
      fetch("/api/settlement/balance"),
      fetch("/api/settlement/history"),
    ]);
    const balJson = await balRes.json() as { data?: { balances: BalanceEntry[]; mealRate: string | null } };
    const histJson = await histRes.json() as { data?: HistoryMonth[] };
    setBalances(balJson.data?.balances ?? []);
    setMealRate(balJson.data?.mealRate ?? null);
    setHistory(histJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runSettlement() {
    if (!confirm("Run month-end settlement? This is permanent and cannot be undone.")) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/settlement/run", { method: "POST" });
      const json = await res.json() as { error?: string; data?: { month: string; transfers: HistoryMonth["transfers"] } };
      if (!res.ok) {
        setRunError(json.error ?? "Failed to run settlement.");
      } else {
        setRunResult({ month: json.data!.month, settledAt: new Date().toISOString(), transfers: json.data!.transfers });
        void load();
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
            {monthName}
            {mealRate && <> · Meal rate: <strong>৳{parseFloat(mealRate).toFixed(2)}/meal</strong></>}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => void runSettlement()} disabled={running}>
            {running ? <><span className="spinner" /> Running...</> : "Run Settlement"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
                      {new Date(h.month + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}
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
