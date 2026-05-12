"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import Decimal from "decimal.js";
import { formatTaka } from "@/lib/utils/decimal";

interface ReportData {
  month: string;
  settledAt: string;
  stats: {
    totalBazar: string;
    totalMeals: number;
    mealRate: string | null;
  };
  settlements: Array<{
    id: string;
    from: string;
    to: string;
    amount: string;
  }>;
  leaderboard: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    totalSpent: string;
    visitCount: number;
  }>;
  personBreakdown: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    meals: number;
    breakdown: {
      mealCost: string;
      maidCharge: string;
      bulkAllocation: string;
      fridgeBillShare: string;
      totalConsumption: string;
    };
    costPerMeal: string | null;
  }>;
}

interface Props {
  params: Promise<{ month: string }>;
}

export default function MonthlyReportClient({ params }: Props) {
  const { month } = use(params);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settlement/${month}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load report.");
      } else {
        setData(json.data);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
          <div style={{ color: "var(--color-danger)", fontWeight: 600 }}>{error || "Report not found."}</div>
          <Link href="/settlement" className="btn btn-ghost" style={{ marginTop: "1rem" }}>Back to Settlements</Link>
        </div>
      </div>
    );
  }

  const monthLabel = new Date(data.month + "-01").toLocaleString("en-US", { month: "long", year: "numeric" });
  const settledDate = new Date(data.settledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });


  return (
    <div className="page-container">
      {/* Navigation */}
      <Link href="/settlement" className="btn btn-sm btn-ghost" style={{ marginBottom: "2rem", paddingLeft: 0 }}>
        ← Back to Settlements
      </Link>

      {/* Hero Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(250,204,21,0.1) 0%, rgba(59,130,246,0.1) 100%)",
        border: "1px solid rgba(250,204,21,0.2)",
        borderRadius: "var(--radius-lg)",
        padding: "2.5rem",
        marginBottom: "2rem",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "2.5rem", fontWeight: 900 }}>{monthLabel}</span>
          <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", fontWeight: 500 }}>Settlement Report</span>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
          ✓ Finalized on {settledDate}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Group Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {[
            {
              icon: "🛒",
              label: "Total Bazar Spend",
              value: formatTaka(new Decimal(data.stats.totalBazar)),
              color: "var(--color-success)"
            },
            {
              icon: "🍽️",
              label: "Total Meals",
              value: data.stats.totalMeals.toString(),
              color: "var(--color-primary-light)"
            },
            {
              icon: "📊",
              label: "Meal Rate",
              value: data.stats.mealRate ? `${formatTaka(new Decimal(data.stats.mealRate))}/meal` : "—",
              color: "var(--color-warning)"
            }
          ].map((stat, idx) => (
            <div key={idx} style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "1.5rem",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Settlement Transfers — Visual Layout */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "2rem",
        }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.75rem", color: "var(--color-text-primary)" }}>
            💸 Settlement Plan
          </div>

          {data.settlements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
              <div style={{ fontSize: "0.875rem" }}>Everyone is settled. No transfers needed.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {data.settlements.map((s, idx) => (
                <div key={s.id} style={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {s.from}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                      pays
                    </div>
                  </div>
                  <div style={{
                    background: "var(--color-primary-glow)",
                    border: "1px solid rgba(59,130,246,0.3)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.5rem 0.875rem",
                    textAlign: "center",
                    minWidth: "100px"
                  }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600 }}>TRANSFER</div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--color-primary-light)" }}>
                      {formatTaka(new Decimal(s.amount))}
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {s.to}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                      receives
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-Member Breakdown */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "2rem",
        }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.75rem", color: "var(--color-text-primary)" }}>
            👥 Member Breakdown
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {data.personBreakdown.map((p) => {
              const totalCost = new Decimal(p.breakdown.totalConsumption);
              const isDebtful = totalCost.gt(0);
              return (
                <div key={p.userId} style={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.5rem",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  {/* Top accent line */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: isDebtful ? "var(--color-danger)" : "var(--color-success)"
                  }} />

                  {/* Header with avatar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", marginTop: "0.5rem" }}>
                    {p.avatarUrl
                      ? <img src={p.avatarUrl} alt={p.name} className="avatar avatar-md" style={{ width: 48, height: 48 }} />
                      : <div className="avatar-fallback" style={{ width: 48, height: 48, fontSize: "1.25rem" }}>{p.name.charAt(0)}</div>
                    }
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)" }}>{p.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                        {p.meals} meals
                      </div>
                    </div>
                  </div>

                  {/* Breakdown rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Bazar contributed</span>
                      <span style={{ fontWeight: 600 }}>—</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Meal cost ({p.meals} × {formatTaka(new Decimal(p.breakdown.mealCost).div(p.meals))})</span>
                      <span style={{ fontWeight: 600, color: "var(--color-danger)" }}>−{formatTaka(new Decimal(p.breakdown.mealCost))}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Maid share</span>
                      <span style={{ fontWeight: 600, color: "var(--color-danger)" }}>−{formatTaka(new Decimal(p.breakdown.maidCharge))}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Bulk allocation</span>
                      <span style={{ fontWeight: 600, color: "var(--color-danger)" }}>−{formatTaka(new Decimal(p.breakdown.bulkAllocation))}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Fridge share</span>
                      <span style={{ fontWeight: 600, color: "var(--color-danger)" }}>−{formatTaka(new Decimal(p.breakdown.fridgeBillShare))}</span>
                    </div>
                  </div>

                  {/* Net balance footer */}
                  <div style={{ textAlign: "center", padding: "1rem", background: isDebtful ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {isDebtful ? "Owes" : "Is Owed"}
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: isDebtful ? "var(--color-danger)" : "var(--color-success)" }}>
                      {isDebtful ? "−" : "+"}{formatTaka(totalCost.abs())}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bazar Leaderboard */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "2rem",
        }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.75rem", color: "var(--color-text-primary)" }}>
            🏆 Bazar Leaderboard
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {data.leaderboard.map((l, idx) => (
              <div key={l.userId} style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem",
                background: idx === 0 ? "var(--color-primary-glow)" : "var(--color-bg-elevated)",
                border: idx === 0 ? "1px solid rgba(59,130,246,0.3)" : "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-sm)",
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: idx === 0 ? "var(--color-primary-light)" : "var(--color-border)",
                  color: idx === 0 ? "var(--color-surface)" : "var(--color-text-secondary)",
                  fontWeight: 900,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {idx + 1}
                </div>

                {l.avatarUrl
                  ? <img src={l.avatarUrl} alt={l.name} className="avatar avatar-sm" />
                  : <div className="avatar-fallback" style={{ width: 32, height: 32, fontSize: "0.75rem" }}>{l.name.charAt(0)}</div>
                }

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--color-text-primary)" }}>{l.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    {l.visitCount} {l.visitCount === 1 ? "trip" : "trips"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: "1.125rem", color: idx === 0 ? "var(--color-primary-light)" : "var(--color-text-primary)" }}>
                    {formatTaka(new Decimal(l.totalSpent))}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    spent
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
