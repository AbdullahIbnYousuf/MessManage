"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { formatMonthLabel } from "@/lib/utils/dates";
import { formatTaka } from "@/lib/utils/decimal";
import { useRouter } from "next/navigation";

interface ProfileData {
  user: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
    email: string;
    status: string;
    joinedAt: string;
    phoneNumber: string | null;
    phoneNumber2: string | null;
    bkashNumber: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
  };
  mealPattern: {
    monday: number; tuesday: number; wednesday: number; thursday: number;
    friday: number; saturday: number; sunday: number;
  } | null;
  aggregates: {
    balance: string;
    routineSpending: string;
    totalSpending: string;
    totalMeals: number;
    bazarVisits: number;
    monthLabel: string;
    breakdown: {
      bazarContributed: string;
      maidPayments: string;
      fridgePayments: string;
      bulkPurchases: string;
      mealCost: string;
      maidCharge: string;
      fridgeBillShare: string;
      bulkAllocations: string;
    };
  };
  activity: {
    recentBazar: Array<{ id: string; amount: string; date: string; note: string | null }>;
    recentBulk: Array<{ id: string; itemName: string; cost: string; date: string }>;
    recentMaid: Array<{ id: string; amount: string; month: string }>;
  };
}

interface Props {
  targetUserId: string;
  currentUserId: string;
}

export default function MemberProfileClient({ targetUserId, currentUserId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<"current" | "prev">("current");

  const load = useCallback(async (month: "current" | "prev" = "current") => {
    setLoading(true);
    setError(null);
    try {
      const query = month === "prev" ? "?month=prev" : "";
      const res = await fetch(`/api/members/${targetUserId}${query}`);
      if (!res.ok) {
        if (res.status === 404) setError("User not found.");
        else setError("Failed to load profile.");
        return;
      }
      const json = await res.json() as { data?: ProfileData };
      if (json.data) setData(json.data);
    } catch (e) {
      console.error(e);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => { void load(selectedMonth); }, [load, selectedMonth]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="card skeleton" style={{ height: 140 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="card skeleton" style={{ height: 100 }} />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>😕</div>
        <div style={{ fontWeight: 600 }}>{error ?? "Something went wrong."}</div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: "1rem" }} onClick={() => router.push("/members")}>
          Back to Directory
        </button>
      </div>
    );
  }

  const { user, aggregates, mealPattern, activity } = data;
  const isOwner = user.id === currentUserId;
  const joinDate = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" });
  const balance = new Decimal(aggregates.balance);
  const isPositive = balance.gte(0);
  const isSettled = balance.eq(0);

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Navigation & Month Selector */}
      <div className="slide-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <button 
          onClick={() => router.push(isOwner ? "/money" : "/members")}
          className="btn btn-ghost btn-sm"
          style={{ minHeight: 44, paddingLeft: 0, color: "var(--color-text-secondary)" }}
        >
          ← {isOwner ? "Money" : "Members"}
        </button>

        <div className="period-switch" aria-label="Profile month">
          <button
            type="button"
            onClick={() => setSelectedMonth("current")}
            className={selectedMonth === "current" ? "is-active" : undefined}
            aria-pressed={selectedMonth === "current"}
          >
            Current
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonth("prev")}
            className={selectedMonth === "prev" ? "is-active" : undefined}
            aria-pressed={selectedMonth === "prev"}
          >
            Previous
          </button>
        </div>
      </div>

      {/* 1. Hero Card */}
      <div className="card-hero slide-up" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.name} className="avatar" style={{ width: 80, height: 80 }} />
        ) : (
          <div className="avatar-fallback" style={{ width: 80, height: 80, fontSize: "2rem" }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>{user.name}</h1>
            <span className={user.status === "active" ? "badge badge-success" : "badge badge-danger"}>
              {user.status}
            </span>
          </div>
          {user.nickname && (
            <div style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.375rem" }}>
              @{user.nickname}
            </div>
          )}
          <div className="text-secondary" style={{ fontSize: "0.8125rem" }}>
            Member since {joinDate}
          </div>
        </div>
      </div>

      {/* 2. Balance Card with Breakdown */}
      <div className={`member-balance-card slide-up-delay-1${isSettled ? " is-settled" : isPositive ? " is-positive" : " is-negative"}`}>
        {/* Balance hero row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <div className="stat-label" style={{ marginBottom: "0.25rem" }}>Provisional monthly balance</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: isPositive ? "var(--color-success)" : "var(--color-danger)", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {formatTaka(balance.abs())}
            </div>
            <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>{aggregates.monthLabel}</div>
          </div>
          <span className={`badge ${isSettled ? "badge-muted" : isPositive ? "badge-success" : "badge-danger"}`}>
            {isSettled ? "Balanced" : isPositive ? "Owed to member" : "Member owes"}
          </span>
        </div>

        {/* Breakdown */}
        <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {/* Credits */}
          {[
            { label: "Bazar contributed", value: aggregates.breakdown.bazarContributed, credit: true },
            { label: "Maid payments", value: aggregates.breakdown.maidPayments, credit: true },
            { label: "Fridge payments", value: aggregates.breakdown.fridgePayments, credit: true },
            { label: "Bulk purchases", value: aggregates.breakdown.bulkPurchases, credit: true },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span className="text-secondary">{row.label}</span>
              <span style={{ color: "var(--color-success)", fontVariantNumeric: "tabular-nums" }}>{formatTaka(row.value)}</span>
            </div>
          ))}

          <div style={{ borderTop: "1px dashed var(--color-border-subtle)", margin: "0.25rem 0" }} />

          {/* Debits */}
          {[
            { label: "Meal cost", value: aggregates.breakdown.mealCost },
            { label: "Maid charge", value: aggregates.breakdown.maidCharge },
            { label: "Fridge share", value: aggregates.breakdown.fridgeBillShare },
            { label: "Bulk allocations", value: aggregates.breakdown.bulkAllocations },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span className="text-secondary">{row.label}</span>
              <span style={{ color: "var(--color-danger)", fontVariantNumeric: "tabular-nums" }}>{formatTaka(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 4 Stat Cards — 2×2 grid */}
      <div className="slide-up-delay-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
        <div className="stat-card">
          <div className="stat-label">Total Meals</div>
          <div className="stat-value" style={{ color: "var(--color-accent)" }}>{aggregates.totalMeals.toLocaleString()}</div>
          <div className="stat-sub">{selectedMonth === "current" ? "this month" : "previous month"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bazar Visits</div>
          <div className="stat-value">{aggregates.bazarVisits.toLocaleString()}</div>
          <div className="stat-sub">{selectedMonth === "current" ? "this month" : "previous month"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Routine Spending</div>
          <div className="stat-value">{formatTaka(aggregates.routineSpending)}</div>
          <div className="stat-sub">{selectedMonth === "current" ? "cash out" : "prev. cash out"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Spending</div>
          <div className="stat-value" style={{ color: "var(--color-primary)" }}>{formatTaka(aggregates.totalSpending)}</div>
          <div className="stat-sub">{selectedMonth === "current" ? "incl. bulk" : "prev. incl. bulk"}</div>
        </div>
      </div>

      <div className="slide-up-delay-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* 3. Meal Pattern */}
          <div className="card">
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Meal Pattern</h3>
            {mealPattern ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.25rem", textAlign: "center" }}>
                {[
                  { label: "M", val: mealPattern.monday },
                  { label: "T", val: mealPattern.tuesday },
                  { label: "W", val: mealPattern.wednesday },
                  { label: "T", val: mealPattern.thursday },
                  { label: "F", val: mealPattern.friday },
                  { label: "S", val: mealPattern.saturday },
                  { label: "S", val: mealPattern.sunday },
                ].map((d, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <div className="text-muted" style={{ fontSize: "0.65rem", fontWeight: 700 }}>{d.label}</div>
                    <div style={{ 
                      background: d.val > 0 ? "var(--color-primary)" : "var(--color-bg-elevated)",
                      color: d.val > 0 ? "#fff" : "var(--color-text-secondary)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.25rem 0",
                      fontSize: "0.875rem",
                      fontWeight: 700
                    }}>
                      {d.val}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: "0.875rem", fontStyle: "italic" }}>No pattern set.</div>
            )}
          </div>
        </div>

        {/* 4. Recent Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, paddingLeft: "0.25rem" }}>Recent Activity</h3>
          
          <div className="card" style={{ padding: "1.25rem" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>Bazar Trips</h4>
            {activity.recentBazar.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activity.recentBazar.map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", padding: "0.375rem 0", borderBottom: "1px solid var(--color-border)" }}>
                    <div>
                      <div>{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>
                      {b.note && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{b.note}</div>}
                    </div>
                    <div style={{ fontWeight: 600 }}>{formatTaka(b.amount)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-muted" style={{ fontSize: "0.875rem" }}>No recent trips.</div>}
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>Bulk Purchases</h4>
            {activity.recentBulk.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activity.recentBulk.map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", padding: "0.375rem 0", borderBottom: "1px solid var(--color-border)" }}>
                    <div>
                      <div>{b.itemName}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>
                    </div>
                    <div style={{ fontWeight: 600 }}>{formatTaka(b.cost)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-muted" style={{ fontSize: "0.875rem" }}>No recent purchases.</div>}
          </div>
          
          <div className="card" style={{ padding: "1.25rem" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>Maid Payments</h4>
            {activity.recentMaid.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activity.recentMaid.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", padding: "0.375rem 0", borderBottom: "1px solid var(--color-border)" }}>
                    <div>{formatMonthLabel(m.month)}</div>
                    <div style={{ fontWeight: 600 }}>{formatTaka(m.amount)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-muted" style={{ fontSize: "0.875rem" }}>No recent payments.</div>}
          </div>
        </div>

      </div>

      {/* 5. Meal Pattern */}
      <div className="slide-up-delay-3">
      </div>

      {/* 6. Contact & Banking — bottom */}
      <div className="card slide-up-delay-3">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem" }}>Contact & Banking</h3>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>Personal Contact</div>
            <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Phone:</span> {user.phoneNumber || "—"}</div>
            <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Alt Phone:</span> {user.phoneNumber2 || "—"}</div>
            <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Email:</span> {user.email}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>Banking</div>
            <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">bKash:</span> {user.bkashNumber || "—"}</div>
            <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Bank:</span> {user.bankName || "—"}</div>
            <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">A/C:</span> {user.bankAccountNumber || "—"}</div>
          </div>
        </div>
        <hr className="divider" style={{ margin: "1.25rem 0" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Emergency Contact</div>
          <div style={{ fontSize: "0.875rem" }}>
            <span className="text-secondary">Name:</span> {user.emergencyContactName || "—"}
            {user.emergencyContactRelation && <span className="text-muted"> ({user.emergencyContactRelation})</span>}
          </div>
          <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Phone:</span> {user.emergencyContactPhone || "—"}</div>
        </div>
      </div>

      {/* 6. Owner Banner */}
      {isOwner && (
        <div className="slide-up-delay-3" style={{ marginTop: "1rem" }}>
          <div style={{ 
            background: "rgba(255,255,255,0.03)", 
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              This is your profile page.
            </div>
            <Link href="/profile" className="btn btn-secondary btn-sm">
              Edit Your Info
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
