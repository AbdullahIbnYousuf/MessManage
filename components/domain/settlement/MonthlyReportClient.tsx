"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClosedCycle { id: string; itemName: string; cost: string; purchasedBy: string; }

interface ReportStats {
  totalBazar: string;
  totalMeals: number;
  mealRate: string | null;
  tripCount: number;
  topSpenderName: string | null;
  topSpenderAmount: string;
  closedCycles: ClosedCycle[];
  totalFridgeBillAmount: string;
}

interface SettlementTransfer {
  id: string;
  from: string; fromAvatar: string | null;
  to:   string; toAvatar:   string | null;
  amount: string;
}

interface BulkAllocItem { itemName: string; amount: string; }

interface PersonBreakdown {
  userId:   string;
  name:     string;
  avatarUrl: string | null;
  meals:    number;
  mealRate: string | null;
  credits: {
    bazarContributed:  string;
    maidPaymentMade:   string;
    bulkPurchaseMade:  string;
    fridgePaymentMade: string;
  };
  debits: {
    mealCost:       string;
    maidCharge:     string;
    bulkAllocTotal: string;
    bulkAllocByItem: BulkAllocItem[];
    fridgeShare:    string;
  };
  netBalance: string;
}

interface LeaderboardEntry {
  userId:     string;
  name:       string;
  avatarUrl:  string | null;
  totalSpent: string;
  visitCount: number;
}

interface ReportData {
  month:          string;
  settledAt:      string;
  stats:          ReportStats;
  settlementPlan: SettlementTransfer[];
  personBreakdown: PersonBreakdown[];
  leaderboard:    LeaderboardEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: string | number): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function Avatar({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className="avatar" style={{ width: size, height: size }} />;
  }
  return (
    <div className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function BreakdownRow({
  label, amount, positive, sub,
}: { label: string; amount: string; positive: boolean; sub?: string }) {
  const v = parseFloat(amount);
  if (v === 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.3rem 0" }}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>
        {label}
        {sub && <span style={{ color: "var(--color-text-muted)", marginLeft: "0.35rem", fontSize: "0.75rem" }}>{sub}</span>}
      </span>
      <span style={{
        fontWeight: 600,
        fontSize: "0.875rem",
        color: positive ? "var(--color-success)" : "var(--color-danger)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {positive ? "+" : "−"}৳{fmt(amount)}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { params: Promise<{ month: string }>; }

export default function MonthlyReportClient({ params }: Props) {
  const { month } = use(params);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/settlement/${month}`);
      const json = await res.json() as { data?: ReportData; error?: string };
      if (!res.ok) setError(json.error ?? "Failed to load report.");
      else setData(json.data ?? null);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div className="page-container" style={{ display: "flex", justifyContent: "center", padding: "5rem" }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (error || !data) return (
    <div className="page-container">
      <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
        <div style={{ color: "var(--color-danger)", fontWeight: 600, marginBottom: "1rem" }}>
          {error ?? "Report not found."}
        </div>
        <Link href="/settlement" className="btn btn-secondary btn-sm">← Back to Settlements</Link>
      </div>
    </div>
  );

  const monthLabel = new Date(data.month + "-02").toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="page-container" style={{ maxWidth: 820 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/settlement" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, marginBottom: "1rem" }}>
          ← Back to Settlements
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.25rem" }}>
              {monthLabel}
            </h1>
            <p className="text-muted" style={{ fontSize: "0.875rem" }}>
              Finalized · {new Date(data.settledAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <span className="badge badge-success" style={{ fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}>
            ✓ Settled
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── 1. Group Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.875rem" }}>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--color-primary)" }}>
            <div className="stat-label">Total Bazar</div>
            <div className="stat-value gradient-text">৳{fmt(data.stats.totalBazar)}</div>
            <div className="stat-sub">{data.stats.tripCount} trip{data.stats.tripCount !== 1 ? "s" : ""}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--color-accent)" }}>
            <div className="stat-label">Total Meals</div>
            <div className="stat-value" style={{ color: "var(--color-accent)" }}>{data.stats.totalMeals}</div>
            <div className="stat-sub">all members</div>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--color-warning)" }}>
            <div className="stat-label">Meal Rate</div>
            <div className="stat-value" style={{ color: "var(--color-warning)" }}>
              {data.stats.mealRate ? `৳${fmt(data.stats.mealRate)}` : "—"}
            </div>
            <div className="stat-sub">per meal</div>
          </div>
          {data.stats.topSpenderName && (
            <div className="stat-card" style={{ borderLeft: "3px solid var(--color-success)" }}>
              <div className="stat-label">Top Bazar</div>
              <div className="stat-value" style={{ fontSize: "1.125rem", color: "var(--color-success)" }}>
                {data.stats.topSpenderName}
              </div>
              <div className="stat-sub">৳{fmt(data.stats.topSpenderAmount)}</div>
            </div>
          )}
        </div>

        {/* Bulk cycles & fridge pills */}
        {(data.stats.closedCycles.length > 0 || parseFloat(data.stats.totalFridgeBillAmount) > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {data.stats.closedCycles.map((c) => (
              <div key={c.id} className="badge badge-warning" style={{ fontSize: "0.8rem", padding: "0.375rem 0.75rem" }}>
                🧺 {c.itemName} closed — ৳{fmt(c.cost)} (paid by {c.purchasedBy})
              </div>
            ))}
            {parseFloat(data.stats.totalFridgeBillAmount) > 0 && (
              <div className="badge badge-primary" style={{ fontSize: "0.8rem", padding: "0.375rem 0.75rem" }}>
                🧊 Fridge Bill — ৳{fmt(data.stats.totalFridgeBillAmount)}
              </div>
            )}
          </div>
        )}

        {/* ── 2. Settlement Plan ── */}
        <div className="card" style={{ borderTop: "3px solid var(--color-primary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "1.1rem" }}>📋</span>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>Settlement Plan</span>
          </div>
          {data.settlementPlan.length === 0 ? (
            <p className="text-muted" style={{ fontSize: "0.875rem" }}>All balances were zero — no transfers needed.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data.settlementPlan.map((s) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  background: "var(--color-bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1rem",
                }}>
                  <Avatar src={s.fromAvatar} name={s.from} size={32} />
                  <span style={{ fontWeight: 600 }}>{s.from}</span>
                  <span style={{ flex: 1, borderTop: "1px dashed var(--color-border)", margin: "0 0.5rem" }} />
                  <span style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "1rem", fontVariantNumeric: "tabular-nums" }}>
                    ৳{fmt(s.amount)}
                  </span>
                  <span style={{ flex: 1, borderTop: "1px dashed var(--color-border)", margin: "0 0.5rem" }} />
                  <span style={{ fontWeight: 600 }}>{s.to}</span>
                  <Avatar src={s.toAvatar} name={s.to} size={32} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 3. Per-Person Breakdown ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🧾</span>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>Member Breakdown</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {data.personBreakdown
              .filter((p) => {
                const hasAny =
                  parseFloat(p.credits.bazarContributed) > 0 ||
                  parseFloat(p.credits.maidPaymentMade) > 0 ||
                  parseFloat(p.credits.bulkPurchaseMade) > 0 ||
                  parseFloat(p.credits.fridgePaymentMade) > 0 ||
                  parseFloat(p.debits.mealCost) > 0 ||
                  parseFloat(p.debits.maidCharge) > 0 ||
                  parseFloat(p.debits.bulkAllocTotal) > 0 ||
                  parseFloat(p.debits.fridgeShare) > 0;
                return hasAny;
              })
              .map((p) => {
              const net = parseFloat(p.netBalance);
              const isPos = net >= 0;
              return (
                <div key={p.userId} className="card" style={{
                  borderTop: `3px solid ${isPos ? "var(--color-success)" : "var(--color-danger)"}`,
                  display: "flex", flexDirection: "column", gap: 0,
                }}>
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    <Avatar src={p.avatarUrl} name={p.name} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: "1rem" }}>{p.name}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>{p.meals} meals this month</div>
                    </div>
                    <div style={{
                      textAlign: "right",
                      padding: "0.35rem 0.7rem",
                      borderRadius: "var(--radius-md)",
                      background: isPos ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                    }}>
                      <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", color: isPos ? "var(--color-success)" : "var(--color-danger)", marginBottom: "0.1rem" }}>
                        Net
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: isPos ? "var(--color-success)" : "var(--color-danger)", fontVariantNumeric: "tabular-nums" }}>
                        {isPos ? "+" : "−"}৳{fmt(Math.abs(net).toString())}
                      </div>
                    </div>
                  </div>

                  {/* Credits section */}
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--color-success)", marginBottom: "0.25rem" }}>
                      Credits
                    </div>
                    <BreakdownRow label="Bazar contributed"  amount={p.credits.bazarContributed}  positive />
                    <BreakdownRow label="Maid payment made"  amount={p.credits.maidPaymentMade}   positive />
                    <BreakdownRow label="Bulk purchase paid" amount={p.credits.bulkPurchaseMade}  positive />
                    <BreakdownRow label="Fridge payment made" amount={p.credits.fridgePaymentMade} positive />
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--color-border-subtle)", margin: "0.5rem 0" }} />

                  {/* Debits section */}
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--color-danger)", marginBottom: "0.25rem" }}>
                      Debits
                    </div>
                    <BreakdownRow
                      label="Meal cost"
                      amount={p.debits.mealCost}
                      positive={false}
                      sub={p.mealRate && p.meals > 0 ? `(${p.meals} × ৳${fmt(p.mealRate)})` : undefined}
                    />
                    <BreakdownRow label="Maid charge"  amount={p.debits.maidCharge}  positive={false} />
                    {p.debits.bulkAllocByItem.map((ba) => (
                      <BreakdownRow key={ba.itemName} label={`${ba.itemName} allocation`} amount={ba.amount} positive={false} />
                    ))}
                    <BreakdownRow label="Fridge share" amount={p.debits.fridgeShare}  positive={false} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. Bazar Leaderboard ── */}
        {data.leaderboard.length > 0 && (
          <div className="card" style={{ borderTop: "3px solid var(--color-accent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "1.1rem" }}>🏆</span>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>Bazar Leaderboard</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.leaderboard.map((l, i) => (
                <div key={l.userId} style={{
                  display: "flex", alignItems: "center", gap: "0.875rem",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  background: i === 0 ? "rgba(250,204,21,0.07)" : "transparent",
                  border: i === 0 ? "1px solid rgba(250,204,21,0.2)" : "1px solid transparent",
                }}>
                  <div style={{
                    width: 26, height: 26,
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "0.8125rem",
                    background: i === 0 ? "var(--color-primary)" : i === 1 ? "var(--color-bg-elevated)" : "transparent",
                    color: i === 0 ? "#121212" : "var(--color-text-muted)",
                    border: i > 0 ? "1px solid var(--color-border)" : "none",
                  }}>
                    {i + 1}
                  </div>
                  <Avatar src={l.avatarUrl} name={l.name} size={30} />
                  <span style={{ flex: 1, fontWeight: 500 }}>{l.name}</span>
                  <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>৳{fmt(l.totalSpent)}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>spent</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 40 }}>
                      <div style={{ fontWeight: 700, color: "var(--color-accent)" }}>{l.visitCount}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>trips</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
