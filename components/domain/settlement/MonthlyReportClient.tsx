"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { use } from "react";

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

  return (
    <div className="page-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/settlement" className="btn btn-sm btn-ghost" style={{ marginBottom: "1rem", paddingLeft: 0 }}>
          ← Back to Settlements
        </Link>
        <div className="section-header">
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>{monthLabel} Summary</h1>
            <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
              Finalized on {new Date(data.settledAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Group Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div className="stat-card">
            <div className="stat-label">Total Bazar</div>
            <div className="stat-value gradient-text">৳{parseFloat(data.stats.totalBazar).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Meals</div>
            <div className="stat-value" style={{ color: "var(--color-primary-light)" }}>{data.stats.totalMeals}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Meal Rate</div>
            <div className="stat-value" style={{ color: "var(--color-warning)" }}>
              {data.stats.mealRate ? `৳${parseFloat(data.stats.mealRate).toFixed(2)}` : "—"}
            </div>
            <div className="stat-sub">per meal</div>
          </div>
        </div>

        {/* Settlement Transfers */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Final Transfers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {data.settlements.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", padding: "0.5rem 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <span style={{ fontWeight: 500 }}>{s.from}</span>
                <span style={{ color: "var(--color-primary-light)" }}>→</span>
                <span style={{ fontWeight: 500 }}>{s.to}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "1rem" }}>৳{parseFloat(s.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Individual Breakdown & Effective Cost */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Member Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {data.personBreakdown.map((p) => (
              <div key={p.userId} style={{ padding: "1rem", borderRadius: "var(--radius-md)", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt={p.name} className="avatar avatar-sm" />
                    : <div className="avatar-fallback" style={{ width: 32, height: 32 }}>{p.name.charAt(0)}</div>
                  }
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>{p.meals} meals</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-secondary">Meal Cost</span>
                    <span>৳{parseFloat(p.breakdown.mealCost).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-secondary">Maid Share</span>
                    <span>৳{parseFloat(p.breakdown.maidCharge).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-secondary">Bulk Share</span>
                    <span>৳{parseFloat(p.breakdown.bulkAllocation).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-secondary">Fridge Share</span>
                    <span>৳{parseFloat(p.breakdown.fridgeBillShare).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.375rem", marginTop: "0.375rem", borderTop: "1px solid var(--color-border-subtle)", fontWeight: 600 }}>
                    <span>Total Cost</span>
                    <span className="gradient-text">৳{parseFloat(p.breakdown.totalConsumption).toLocaleString()}</span>
                  </div>
                </div>

                {p.costPerMeal && (
                  <div style={{ textAlign: "center", padding: "0.5rem", borderRadius: "var(--radius-sm)", background: "var(--color-primary-glow)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <div className="text-muted" style={{ fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Effective Cost Per Meal</div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--color-primary-light)" }}>৳{parseFloat(p.costPerMeal).toFixed(2)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bazar Leaderboard */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Bazar Leaderboard</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Member</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Total Spent</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Visits</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((l) => (
                  <tr key={l.userId} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td style={{ padding: "0.75rem 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {l.avatarUrl
                        ? <img src={l.avatarUrl} alt={l.name} className="avatar avatar-xs" />
                        : <div className="avatar-fallback" style={{ width: 24, height: 24, fontSize: "0.625rem" }}>{l.name.charAt(0)}</div>
                      }
                      <span>{l.name}</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>৳{parseFloat(l.totalSpent).toLocaleString()}</td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>{l.visitCount} times</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
