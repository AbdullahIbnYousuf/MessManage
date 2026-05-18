"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
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

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
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

export default function MemberProfileClient({ targetUserId, currentUserId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${targetUserId}`);
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

  useEffect(() => { void load(); }, [load]);

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
  const displayName = user.nickname ?? user.name;
  const joinDate = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const balanceNum = parseFloat(aggregates.balance);
  const isPositive = balanceNum >= 0;

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Navigation */}
      <div className="slide-up">
        <button 
          onClick={() => router.push("/members")} 
          className="btn btn-ghost btn-sm"
          style={{ paddingLeft: 0, color: "var(--color-text-secondary)" }}
        >
          ← Back to Directory
        </button>
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

      {/* 2. Financial Summary */}
      <div className="slide-up-delay-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.875rem" }}>
        {/* Balance Card */}
        <div className="stat-card" style={{ border: `1px solid ${isPositive ? "rgba(78,158,106,0.3)" : "rgba(192,80,80,0.3)"}`, background: "var(--color-bg-surface)" }}>
          <div className="stat-label">Balance</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: isPositive ? "var(--color-success)" : "var(--color-danger)", letterSpacing: "-0.02em" }}>
            {isPositive ? "+" : "−"}৳<AnimatedNumber value={Math.abs(balanceNum)} decimals={2} />
          </div>
          <div className="stat-sub">net this month</div>
        </div>
        
        {/* Spending Card */}
        <div className="stat-card">
          <div className="stat-label">Spending</div>
          <div className="stat-value">৳<AnimatedNumber value={parseFloat(aggregates.routineSpending)} decimals={2} /></div>
          <div className="stat-sub">routine cash out</div>
        </div>

        {/* Total Spending Card */}
        <div className="stat-card">
          <div className="stat-label">Total Spending</div>
          <div className="stat-value" style={{ color: "var(--color-primary)" }}>৳<AnimatedNumber value={parseFloat(aggregates.totalSpending)} decimals={2} /></div>
          <div className="stat-sub">includes bulk purchases</div>
        </div>

        {/* Total Meals Card */}
        <div className="stat-card">
          <div className="stat-label">Total Meals</div>
          <div className="stat-value" style={{ color: "var(--color-accent)" }}><AnimatedNumber value={aggregates.totalMeals} /></div>
          <div className="stat-sub">this month</div>
        </div>

        {/* Bazar Visits Card */}
        <div className="stat-card">
          <div className="stat-label">Bazar Visits</div>
          <div className="stat-value"><AnimatedNumber value={aggregates.bazarVisits} /></div>
          <div className="stat-sub">this month</div>
        </div>
      </div>

      {/* 2b. Balance Breakdown */}
      <div className="card slide-up-delay-1">
        <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.875rem" }}>Balance Breakdown</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem 1rem", fontSize: "0.8125rem" }}>
          <span className="text-secondary">Bazar contributed:</span>
          <span style={{ color: "var(--color-success)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>+৳{parseFloat(aggregates.breakdown.bazarContributed).toLocaleString()}</span>

          <span className="text-secondary">Maid payments:</span>
          <span style={{ color: "var(--color-success)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>+৳{parseFloat(aggregates.breakdown.maidPayments).toLocaleString()}</span>

          <span className="text-secondary">Fridge payments:</span>
          <span style={{ color: "var(--color-success)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>+৳{parseFloat(aggregates.breakdown.fridgePayments).toLocaleString()}</span>

          <span className="text-secondary">Bulk purchases:</span>
          <span style={{ color: "var(--color-success)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>+৳{parseFloat(aggregates.breakdown.bulkPurchases).toLocaleString()}</span>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--color-border-subtle)", margin: "0.25rem 0" }} />

          <span className="text-secondary">Meal cost:</span>
          <span style={{ color: "var(--color-danger)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−৳{parseFloat(aggregates.breakdown.mealCost).toLocaleString()}</span>

          <span className="text-secondary">Maid charge:</span>
          <span style={{ color: "var(--color-danger)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−৳{parseFloat(aggregates.breakdown.maidCharge).toLocaleString()}</span>

          <span className="text-secondary">Fridge share:</span>
          <span style={{ color: "var(--color-danger)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−৳{parseFloat(aggregates.breakdown.fridgeBillShare).toLocaleString()}</span>

          <span className="text-secondary">Bulk allocations:</span>
          <span style={{ color: "var(--color-danger)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−৳{parseFloat(aggregates.breakdown.bulkAllocations).toLocaleString()}</span>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--color-border-subtle)", margin: "0.25rem 0" }} />

          <span style={{ fontWeight: 700 }}>Net Balance:</span>
          <span style={{ fontWeight: 800, color: isPositive ? "var(--color-success)" : "var(--color-danger)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {isPositive ? "+" : "−"}৳{Math.abs(balanceNum).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
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

          {/* 5. Contact & Banking Info */}
          <div className="card">
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem" }}>Contact & Banking</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem" }}>
              {/* Personal Contact */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>Personal Contact</div>
                <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Phone:</span> {user.phoneNumber || "—"}</div>
                <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Alt Phone:</span> {user.phoneNumber2 || "—"}</div>
                <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Email:</span> {user.email}</div>
              </div>

              {/* Banking */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>Banking</div>
                <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">bKash:</span> {user.bkashNumber || "—"}</div>
                <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Bank:</span> {user.bankName || "—"}</div>
                <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">A/C:</span> {user.bankAccountNumber || "—"}</div>
              </div>
            </div>

            <hr className="divider" style={{ margin: "1.25rem 0" }} />
            
            {/* Emergency Contact */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Emergency Contact</div>
              <div style={{ fontSize: "0.875rem" }}>
                <span className="text-secondary">Name:</span> {user.emergencyContactName || "—"}
                {user.emergencyContactRelation && <span className="text-muted"> ({user.emergencyContactRelation})</span>}
              </div>
              <div style={{ fontSize: "0.875rem" }}><span className="text-secondary">Phone:</span> {user.emergencyContactPhone || "—"}</div>
            </div>
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
                      <div>{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      {b.note && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{b.note}</div>}
                    </div>
                    <div style={{ fontWeight: 600 }}>৳{parseFloat(b.amount).toLocaleString()}</div>
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
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    </div>
                    <div style={{ fontWeight: 600 }}>৳{parseFloat(b.cost).toLocaleString()}</div>
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
                    <div>{new Date(m.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
                    <div style={{ fontWeight: 600 }}>৳{parseFloat(m.amount).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-muted" style={{ fontSize: "0.875rem" }}>No recent payments.</div>}
          </div>
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
