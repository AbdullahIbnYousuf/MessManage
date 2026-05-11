"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ActiveTripCard from "@/components/domain/bazar/ActiveTripCard";

interface TodayMeal {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mealCount: number;
}

interface ActiveTrip {
  id: string;
  status: string;
  triggeredAt: string;
  shoppingNotes: string | null;
  assignee1: { id: string; name: string; avatarUrl: string | null } | null;
  assignee2: { id: string; name: string; avatarUrl: string | null } | null;
}

interface DashboardData {
  todayMeals: TodayMeal[];
  todayTotal: number;
  activeTrip: ActiveTrip | null;
  monthlyTotalBazar: string;
  monthlyTotalMeals: number;
  mealRate: string | null;
}

interface Props {
  name: string;
  nickname: string | null;
}

export default function DashboardClient({ name, nickname }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    const json = await res.json() as { data?: DashboardData };
    setData(json.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const displayName = nickname ? nickname : name.split(" ")[0];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          Welcome back, {displayName}! 👋
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.875rem" }}>{monthName}</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Today's meal table — maid view (MOVED TO TOP) */}
          <div className="card" style={{ border: "1px solid var(--color-primary-glow)", boxShadow: "0 0 20px rgba(59,130,246,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Today&apos;s Meals</div>
                <div className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
                  For the maid — how many meals to cook today
                </div>
              </div>
              <div
                style={{
                  background: "var(--color-primary-glow)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.375rem 0.875rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.6875rem", color: "var(--color-primary-light)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-primary-light)", lineHeight: 1 }}>{data.todayTotal}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {data.todayMeals.map((m) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.625rem", borderRadius: "var(--radius-md)", background: m.mealCount > 0 ? "var(--color-bg-elevated)" : "transparent", opacity: m.mealCount === 0 ? 0.5 : 1 }}>
                  {m.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.avatarUrl} alt={m.name} className="avatar avatar-sm" />
                    : <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{m.name.charAt(0)}</div>
                  }
                  <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: m.mealCount > 0 ? 500 : 400 }}>{m.name}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: m.mealCount > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)",
                      minWidth: 24,
                      textAlign: "center",
                    }}
                  >
                    {m.mealCount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <div className="stat-card">
              <div className="stat-label">Total Bazar</div>
              <div className="stat-value gradient-text">
                ৳{parseFloat(data.monthlyTotalBazar).toLocaleString()}
              </div>
              <div className="stat-sub">this month</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Meals</div>
              <div className="stat-value" style={{ color: "var(--color-primary-light)" }}>
                {data.monthlyTotalMeals}
              </div>
              <div className="stat-sub">recorded this month</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Meal Rate</div>
              <div className="stat-value" style={{ color: "var(--color-warning)" }}>
                {data.mealRate ? `৳${parseFloat(data.mealRate).toFixed(2)}` : "—"}
              </div>
              <div className="stat-sub">per meal</div>
            </div>
          </div>

          {/* Active bazar trip box */}
          {data.activeTrip && (
            <ActiveTripCard
              trip={data.activeTrip}
              onNotesUpdated={(notes) =>
                setData((prev) =>
                  prev && prev.activeTrip
                    ? { ...prev, activeTrip: { ...prev.activeTrip, shoppingNotes: notes } }
                    : prev
                )
              }
            />
          )}



          {/* Quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
            {[
              { href: "/meals", label: "My Meals", icon: "🍽️" },
              { href: "/bazar", label: "Bazar", icon: "🛒" },
              { href: "/settlement", label: "Balances", icon: "📊" },
              { href: "/maid", label: "Maid", icon: "🧹" },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <div className="card" style={{ textAlign: "center", padding: "1rem", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.375rem" }}>{link.icon}</div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{link.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
          Could not load dashboard data.
        </div>
      )}
    </div>
  );
}
