"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  userId: string;
  name: string;
  nickname: string | null;
  isAlertPeriod: boolean;
  isPreviousMonthSettled: boolean;
  previousMonthLabel: string;
}

/* ── Animated number counter ── */
function AnimatedNumber({
  value,
  prefix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const duration = 900;

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    startRef.current = start;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();

  return <>{prefix}{formatted}</>;
}

/* ── Skeleton block ── */
function Skeleton({ height = 20, width = "100%", style = {} }: { height?: number; width?: string | number; style?: React.CSSProperties }) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: "var(--radius-md)", ...style }}
    />
  );
}

/* ── Dashboard skeleton ── */
function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Meals card skeleton */}
      <div className="card-hero">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Skeleton height={18} width={140} />
            <Skeleton height={13} width={200} />
          </div>
          <Skeleton height={56} width={64} style={{ borderRadius: "var(--radius-md)" }} />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", marginBottom: "0.25rem" }}>
            <Skeleton height={28} width={28} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <Skeleton height={14} width={120} />
            <Skeleton height={20} width={24} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      {/* Balance card skeleton */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Skeleton height={16} width={100} />
          <Skeleton height={12} width={180} />
        </div>
        <Skeleton height={36} width={100} />
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card" style={{ gap: "0.5rem" }}>
            <Skeleton height={10} width={80} />
            <Skeleton height={32} width={100} />
            <Skeleton height={12} width={120} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient({
  userId,
  name,
  nickname,
  isAlertPeriod,
  isPreviousMonthSettled,
  previousMonthLabel,
}: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [res, balRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/settlement/balance"),
      ]);

      const json = (await res.json()) as { data?: DashboardData };
      const balJson = (await balRes.json()) as {
        data?: { balances: Array<{ userId: string; balance: string }> };
      };

      setData(json.data ?? null);

      if (balJson.data?.balances) {
        const myBal = balJson.data.balances.find((b) => b.userId === userId);
        if (myBal) setBalance(myBal.balance);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const displayName = nickname ? nickname : name.split(" ")[0];

  const balanceNum = balance !== null ? parseFloat(balance) : null;
  const isPositive = balanceNum !== null && balanceNum >= 0;

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="slide-up" style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "1.375rem" }}>👋</span>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            Hey, {displayName}!
          </h1>
        </div>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", margin: 0 }}>
          {monthName}
        </p>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* ── Alert Banner ── */}
          {isAlertPeriod && !isPreviousMonthSettled && (
            <div
              className="slide-up"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(249,115,22,0.08))",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem 1.125rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.875rem",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1rem",
                }}
              >
                ⚠️
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-warning)", marginBottom: "0.2rem" }}>
                  Auto-settlement Incoming
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                  Auto-settlement for {previousMonthLabel} will run on the 5th. Please resolve any pending issues.
                </div>
              </div>
            </div>
          )}

          {/* ── Today's Meals Card ── */}
          <div className="card-hero slide-up-delay-1">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)", marginBottom: "0.2rem" }}>
                  🍽️ Today&apos;s Meals
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  How many meals to cook today
                </div>
              </div>

              {/* Total badge */}
              <div
                style={{
                  background: "var(--color-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.5rem 0.875rem",
                  textAlign: "center",
                  boxShadow: "0 4px 16px rgba(249,115,22,0.4)",
                  minWidth: 60,
                }}
              >
                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.75)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Total
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                  <AnimatedNumber value={data.todayTotal} />
                </div>
              </div>
            </div>

            {/* Member rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {data.todayMeals.map((m, i) => (
                <div
                  key={m.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: m.mealCount > 0 ? "rgba(249,115,22,0.06)" : "transparent",
                    border: `1px solid ${m.mealCount > 0 ? "rgba(249,115,22,0.12)" : "transparent"}`,
                    opacity: m.mealCount === 0 ? 0.45 : 1,
                    transition: "all 0.18s ease",
                    animation: `slideUp 0.3s cubic-bezier(0.16,1,0.3,1) ${0.05 * i + 0.15}s both`,
                  }}
                >
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt={m.name} className="avatar avatar-sm" />
                  ) : (
                    <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: m.mealCount > 0 ? 600 : 400 }}>
                    {m.name}
                  </span>
                  <div
                    style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: m.mealCount > 0 ? "var(--color-primary)" : "var(--color-bg-elevated)",
                      border: `1px solid ${m.mealCount > 0 ? "var(--color-primary)" : "var(--color-border)"}`,
                      fontWeight: 800,
                      fontSize: "0.875rem",
                      color: m.mealCount > 0 ? "#fff" : "var(--color-text-muted)",
                      boxShadow: m.mealCount > 0 ? "0 2px 8px rgba(249,115,22,0.35)" : "none",
                    }}
                  >
                    {m.mealCount}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── My Balance Card ── */}
          {balanceNum !== null && (
            <div
              className="slide-up-delay-2"
              style={{
                background: isPositive
                  ? "linear-gradient(135deg, var(--color-bg-elevated), rgba(34,197,94,0.06))"
                  : "linear-gradient(135deg, var(--color-bg-elevated), rgba(239,68,68,0.06))",
                border: `1px solid ${isPositive ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                borderRadius: "var(--radius-xl)",
                padding: "1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: isPositive
                  ? "0 4px 20px rgba(34,197,94,0.06)"
                  : "0 4px 20px rgba(239,68,68,0.06)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isPositive ? "var(--color-success)" : "var(--color-danger)",
                      boxShadow: isPositive ? "0 0 6px var(--color-success)" : "0 0 6px var(--color-danger)",
                    }}
                  />
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--color-text-primary)" }}>
                    My Balance
                  </div>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  Current month net settlement
                </div>
              </div>
              <div
                style={{
                  fontSize: "1.875rem",
                  fontWeight: 900,
                  color: isPositive ? "var(--color-success)" : "var(--color-danger)",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.02em",
                }}
              >
                {isPositive ? "+" : "−"}৳
                <AnimatedNumber value={Math.abs(balanceNum)} decimals={2} />
              </div>
            </div>
          )}

          {/* ── Monthly Stats ── */}
          <div
            className="slide-up-delay-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.875rem" }}
          >
            {/* Bazar */}
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(249,115,22,0.12)",
                    border: "1px solid rgba(249,115,22,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                  }}
                >
                  🛒
                </div>
                <div className="stat-label">Total Bazar</div>
              </div>
              <div className="stat-value gradient-text">
                ৳<AnimatedNumber value={parseFloat(data.monthlyTotalBazar)} decimals={0} />
              </div>
              <div className="stat-sub">this month</div>
            </div>

            {/* Meals */}
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                  }}
                >
                  🍽️
                </div>
                <div className="stat-label">Total Meals</div>
              </div>
              <div className="stat-value" style={{ color: "var(--color-accent)" }}>
                <AnimatedNumber value={data.monthlyTotalMeals} />
              </div>
              <div className="stat-sub">recorded this month</div>
            </div>

            {/* Meal Rate */}
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                  }}
                >
                  📊
                </div>
                <div className="stat-label">Meal Rate</div>
              </div>
              <div className="stat-value" style={{ color: "var(--color-warning)" }}>
                {data.mealRate ? (
                  <>৳<AnimatedNumber value={parseFloat(data.mealRate)} decimals={2} /></>
                ) : (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "1.25rem" }}>—</span>
                )}
              </div>
              <div className="stat-sub">per meal</div>
            </div>
          </div>

          {/* ── Active Bazar Trip ── */}
          {data.activeTrip && (
            <div className="slide-up-delay-4">
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
            </div>
          )}

          {/* ── Quick Links ── */}
          <div
            className="slide-up-delay-5"
            style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}
          >
            {[
              { href: "/meals", label: "Meals", icon: "🍽️", color: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)" },
              { href: "/bazar", label: "Bazar", icon: "🛒", color: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" },
              { href: "/settlement", label: "Balances", icon: "📊", color: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
              { href: "/maid", label: "Maid", icon: "🧹", color: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)" },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background: link.color,
                    border: `1px solid ${link.border}`,
                    borderRadius: "var(--radius-lg)",
                    padding: "0.875rem 0.5rem",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "1.375rem", marginBottom: "0.375rem" }}>{link.icon}</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {link.label}
                  </div>
                </div>
              </Link>
            ))}
          </div>

        </div>
      ) : (
        <div
          className="card"
          style={{ textAlign: "center", padding: "3rem 2rem", color: "var(--color-text-muted)" }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>😕</div>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Could not load dashboard</div>
          <div style={{ fontSize: "0.875rem" }}>Check your connection and try again.</div>
        </div>
      )}
    </div>
  );
}
