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
  daysUntilSettle: number;
  monthName: string;
  dayName: string;
  isMaidChargeAlertPeriod: boolean;
  isMaidChargeApplied: boolean;
  daysUntilMaidCharge: number;
}

/* ── Animated number counter ── */
function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const duration = 800;

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>;
}

/* ── Skeleton block ── */
function Skel({ h = 16, w = "100%", round = false }: { h?: number; w?: string | number; round?: boolean }) {
  return (
    <div
      className="skeleton"
      style={{
        height: h,
        width: w,
        borderRadius: round ? "50%" : "var(--radius-md)",
        flexShrink: 0,
      }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="card-hero" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Skel h={16} w={130} />
            <Skel h={12} w={190} />
          </div>
          <Skel h={52} w={60} />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Skel h={28} w={28} round />
            <Skel h={13} w={110} />
            <Skel h={26} w={26} round />
          </div>
        ))}
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Skel h={15} w={90} />
          <Skel h={11} w={170} />
        </div>
        <Skel h={32} w={110} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.875rem" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card" style={{ gap: "0.5rem" }}>
            <Skel h={10} w={70} />
            <Skel h={30} w={90} />
            <Skel h={11} w={110} />
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
  daysUntilSettle,
  monthName,
  dayName,
  isMaidChargeAlertPeriod,
  isMaidChargeApplied,
  daysUntilMaidCharge,
}: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMealsExpanded, setIsMealsExpanded] = useState(false);

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

  useEffect(() => { void load(); }, [load]);

  const displayName = nickname ?? name.split(" ")[0];
  const balanceNum = balance !== null ? parseFloat(balance) : null;
  const isPositive = balanceNum !== null && balanceNum >= 0;

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="slide-up" style={{ marginBottom: "1.75rem" }}>
        <h1 style={{
          fontSize: "1.5rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "0 0 0.25rem",
          color: "var(--color-text-primary)",
        }}>
          Hey, {displayName} 👋
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", margin: 0 }}>
          {monthName}
        </p>
      </div>

      {loading ? <DashboardSkeleton /> : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

          {/* ── Alert Banner — Auto-settlement ── */}
          {isAlertPeriod && !isPreviousMonthSettled && (
            <div
              className="slide-up"
              style={{
                background: "var(--color-warning-bg)",
                border: "1px solid rgba(196,154,60,0.25)",
                borderRadius: "var(--radius-lg)",
                padding: "0.875rem 1rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "1rem", lineHeight: 1.5 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-warning)", marginBottom: "0.2rem" }}>
                  {daysUntilSettle === 1 ? "Auto-settlement Tomorrow" : `Auto-settlement in ${daysUntilSettle} Days`}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                  {daysUntilSettle === 1
                    ? `Auto-settlement for ${previousMonthLabel} runs tomorrow.`
                    : `Auto-settlement for ${previousMonthLabel} runs in ${daysUntilSettle} days on the 20th.`}
                </div>
              </div>
            </div>
          )}

          {/* ── Alert Banner — Maid charges ── */}
          {isMaidChargeAlertPeriod && !isMaidChargeApplied && (
            <div
              className="slide-up"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "0.875rem 1rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "1rem", lineHeight: 1.5 }}>🧹</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-secondary)", marginBottom: "0.2rem" }}>
                  {daysUntilMaidCharge === 0
                    ? "Maid Charges Applying Today"
                    : daysUntilMaidCharge === 1
                    ? "Maid Charges Apply Tomorrow"
                    : `Maid Charges in ${daysUntilMaidCharge} Days`}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                  {daysUntilMaidCharge === 0
                    ? "Maid charges will be auto-applied to all active members today."
                    : "Maid charges will be auto-applied to all active members on the 28th."}
                </div>
              </div>
            </div>
          )}

          {/* ── Meal Count (Collapsible) ── */}
          <div className="card-hero slide-up-delay-1">
            <div 
              style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: isMealsExpanded ? "1rem" : 0, cursor: "pointer" }}
              onClick={() => setIsMealsExpanded(prev => !prev)}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.1rem" }}>
                  Meal Count
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-0.01em" }}>
                  {dayName}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {/* Total pill */}
                <div style={{
                  background: "var(--color-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.4rem 0.875rem",
                  textAlign: "center",
                  minWidth: 56,
                }}>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Total
                  </div>
                  <div style={{ fontSize: "1.625rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                    <AnimatedNumber value={data.todayTotal} />
                  </div>
                </div>
                
                {/* Chevron icon */}
                <div style={{ 
                  color: "var(--color-text-muted)", 
                  transform: isMealsExpanded ? "rotate(180deg)" : "rotate(0deg)", 
                  transition: "transform 0.2s ease" 
                }}>
                  ▼
                </div>
              </div>
            </div>

            {isMealsExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.875rem", marginTop: "0.5rem" }}>
                {data.todayMeals.map((m, i) => (
                  <div
                    key={m.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0.625rem",
                      borderRadius: "var(--radius-md)",
                      background: m.mealCount > 0 ? "var(--color-bg-elevated)" : "transparent",
                      opacity: m.mealCount === 0 ? 0.4 : 1,
                      animation: `slideUp 0.3s cubic-bezier(0.16,1,0.3,1) ${0.05 * i}s both`,
                    }}
                  >
                    {m.avatarUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.avatarUrl} alt={m.name} className="avatar avatar-sm" />
                      : <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{m.name.charAt(0)}</div>
                    }
                    <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: m.mealCount > 0 ? 600 : 400 }}>
                      {m.name}
                    </span>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: m.mealCount > 0 ? "var(--color-primary)" : "var(--color-bg-base)",
                      border: `1px solid ${m.mealCount > 0 ? "var(--color-primary)" : "var(--color-border)"}`,
                      fontWeight: 800,
                      fontSize: "0.8125rem",
                      color: m.mealCount > 0 ? "#fff" : "var(--color-text-muted)",
                      flexShrink: 0,
                    }}>
                      {m.mealCount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Balance Card ── */}
          {balanceNum !== null && (
            <Link
              href={`/members/${userId}`}
              className="slide-up-delay-2"
              style={{
                textDecoration: "none",
                display: "flex",
                background: "var(--color-bg-surface)",
                border: `1px solid ${isPositive ? "rgba(78,158,106,0.3)" : "rgba(192,80,80,0.3)"}`,
                borderRadius: "var(--radius-xl)",
                padding: "1.125rem 1.25rem",
                alignItems: "center",
                justifyContent: "space-between",
                /* Soft shadow only, no glow */
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
                  My Balance
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  Current month net settlement
                </div>
              </div>
              <div style={{
                fontSize: "1.75rem",
                fontWeight: 900,
                color: isPositive ? "var(--color-success)" : "var(--color-danger)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}>
                {isPositive ? "+" : "−"}৳<AnimatedNumber value={Math.abs(balanceNum)} decimals={2} />
              </div>
            </Link>
          )}

          {/* ── Monthly Stats ── */}
          <div
            className="slide-up-delay-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.875rem" }}
          >
            {[
              {
                label: "Total Bazar",
                value: <><span className="gradient-text">৳<AnimatedNumber value={parseFloat(data.monthlyTotalBazar)} /></span></>,
                sub: "this month",
                dot: "var(--color-primary)",
              },
              {
                label: "Total Meals",
                value: <span style={{ color: "var(--color-accent)" }}><AnimatedNumber value={data.monthlyTotalMeals} /></span>,
                sub: "recorded this month",
                dot: "var(--color-accent)",
              },
              {
                label: "Meal Rate",
                value: data.mealRate
                  ? <span style={{ color: "var(--color-warning)" }}>৳<AnimatedNumber value={parseFloat(data.mealRate)} decimals={2} /></span>
                  : <span style={{ color: "var(--color-text-muted)", fontSize: "1.25rem" }}>—</span>,
                sub: "per meal",
                dot: "var(--color-warning)",
              },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.125rem" }}>
                  {/* Small dot instead of a glowing circle */}
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                  <div className="stat-label">{s.label}</div>
                </div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
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
              { href: "/meals",      label: "Meals",    icon: "🍽️" },
              { href: "/bazar",      label: "Bazar",    icon: "🛒" },
              { href: "/settlement", label: "Balances", icon: "📊" },
              { href: "/maid",       label: "Maid",     icon: "🧹" },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "0.875rem 0.5rem",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "border-color 0.18s, transform 0.18s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-primary)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ fontSize: "1.25rem", marginBottom: "0.375rem" }}>{link.icon}</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {link.label}
                  </div>
                </div>
              </Link>
            ))}
          </div>

        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>😕</div>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Could not load dashboard</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>Check your connection and try again.</div>
        </div>
      )}
    </div>
  );
}
