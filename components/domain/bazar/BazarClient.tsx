"use client";

import { useState, useEffect, useCallback } from "react";
import ActiveTripCard from "@/components/domain/bazar/ActiveTripCard";
import ExpenseForm from "@/components/domain/bazar/ExpenseForm";
import { formatNumericDate } from "@/lib/utils/dates";

interface Assignee {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Trip {
  id: string;
  status: string;
  triggeredAt: string;
  shoppingNotes: string | null;
  assignee1: Assignee | null;
  assignee2: Assignee | null;
}

interface Expense {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  amount: string;
  note: string | null;
  date: string;
  submittedAt: string;
}

interface LeaderEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  visits: number;
}

function LeaderboardCard({ top3, rest, medals }: {
  top3: LeaderEntry[];
  rest: LeaderEntry[];
  medals: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card">
      <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Bazar Leaderboard</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {top3.map((entry, i) => (
          <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span style={{ fontSize: "1.1rem", width: 24, textAlign: "center", flexShrink: 0 }}>{medals[i]}</span>
            {entry.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.avatarUrl} alt={entry.name} className="avatar avatar-sm" />
            ) : (
              <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{entry.name.charAt(0)}</div>
            )}
            <span style={{ flex: 1, fontWeight: 500, fontSize: "0.875rem" }}>{entry.name}</span>
            <span className="badge badge-primary">{entry.visits} trips</span>
          </div>
        ))}
        {rest.length > 0 && (
          <>
            {expanded && rest.map((entry, i) => (
              <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid var(--color-border-subtle)" }} className="fade-in">
                <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", width: 24, textAlign: "center", fontWeight: 700, flexShrink: 0 }}>{i + 4}</span>
                {entry.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.avatarUrl} alt={entry.name} className="avatar avatar-sm" />
                ) : (
                  <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{entry.name.charAt(0)}</div>
                )}
                <span style={{ flex: 1, fontWeight: 500, fontSize: "0.875rem" }}>{entry.name}</span>
                <span className="badge badge-primary">{entry.visits} trips</span>
              </div>
            ))}
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.5rem 0", fontSize: "0.8125rem", color: "var(--color-text-muted)", textAlign: "left" }}
            >
              {expanded ? "▲ Show less" : `▼ +${rest.length} more`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PastExpensesCard({ expenses }: { expenses: Expense[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card">
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Past Expenses</span>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {expenses.length} entries
          <span style={{ transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column" }} className="fade-in">
          {expenses.map((e, i) => (
            <ExpenseRow key={e.id} expense={e} isLast={i === expenses.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ expense: e, isLast }: { expense: Expense; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasNote = !!e.note;

  return (
    <div>
      <div
        onClick={() => hasNote && setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem 0",
          borderBottom: isLast && !expanded ? "none" : "1px solid var(--color-border-subtle)",
          cursor: hasNote ? "pointer" : "default",
        }}
      >
        {e.userAvatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={e.userAvatar} alt={e.userName} className="avatar avatar-sm" />
          : <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{e.userName.charAt(0)}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{e.userName}</div>
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>{formatNumericDate(e.date)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: "var(--color-success)", fontSize: "0.9375rem" }}>
            +৳{parseFloat(e.amount).toLocaleString()}
          </span>
          {hasNote && (
            <span style={{
              fontSize: "1rem",
              color: expanded ? "var(--color-text-secondary)" : "var(--color-text-muted)",
              lineHeight: 1,
              userSelect: "none",
            }}>
              {expanded ? "×" : "≡"}
            </span>
          )}
        </div>
      </div>
      {expanded && e.note && (
        <div style={{
          padding: "0.5rem 0.75rem 0.625rem 2.75rem",
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-elevated)",
          borderRadius: "0 0 var(--radius-md) var(--radius-md)",
          whiteSpace: "pre-wrap",
        }}>
          {e.note}
        </div>
      )}
    </div>
  );
}

export default function BazarClient({ todayStr }: { todayStr: string }) {
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined); // undefined = loading
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [triggeringTrip, setTriggeringTrip] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    const res = await fetch("/api/bazar/trip");
    const json = await res.json() as { data: Trip | null };
    setTrip(json.data);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/bazar/history");
    const json = await res.json() as { data?: { expenses: Expense[]; leaderboard: LeaderEntry[] } };
    setExpenses(json.data?.expenses ?? []);
    setLeaderboard(json.data?.leaderboard ?? []);
  }, []);

  useEffect(() => {
    void loadTrip();
    void loadHistory();
  }, [loadTrip, loadHistory]);

  async function triggerTrip() {
    setTriggeringTrip(true);
    setTriggerError(null);
    try {
      const res = await fetch("/api/bazar/trip", { method: "POST" });
      const json = await res.json() as { error?: string; data?: Trip };
      if (!res.ok) {
        setTriggerError(json.error ?? "Failed to open trip.");
      } else {
        setTrip(json.data ?? null);
      }
    } catch {
      setTriggerError("Network error.");
    } finally {
      setTriggeringTrip(false);
    }
  }

  function handleExpenseSubmitted() {
    void loadTrip();
    void loadHistory();
  }

  const loading = trip === undefined;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Bazar</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
            Manage bazar trips, submit expenses, and track contributions.
          </p>
        </div>
        {!loading && !trip && (
          <button
            className="btn btn-primary"
            onClick={() => void triggerTrip()}
            disabled={triggeringTrip}
          >
            {triggeringTrip ? <><span className="spinner" /> Opening...</> : "⚡ Trigger Bazar Trip"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {triggerError && (
            <div style={{ background: "var(--color-danger-glow)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "var(--color-danger)", fontSize: "0.875rem" }}>
              {triggerError}
            </div>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (() => {
            const top3 = leaderboard.slice(0, 3);
            const rest = leaderboard.slice(3);
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <LeaderboardCard top3={top3} rest={rest} medals={medals} />
            );
          })()}

          {/* Active trip */}
          {trip ? (
            <>
              <ActiveTripCard
                trip={trip}
                onNotesUpdated={(notes) => setTrip((t) => t ? { ...t, shoppingNotes: notes } : t)}
              />
              <ExpenseForm onSubmitted={handleExpenseSubmitted} tripNotes={trip.shoppingNotes} todayStr={todayStr} />
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🛒</div>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>No active bazar trip</div>
              <p className="text-secondary" style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                Trigger a new trip when someone is going to the bazar. The system will suggest the two members with the fewest visits.
              </p>
              <button className="btn btn-primary" onClick={() => void triggerTrip()} disabled={triggeringTrip}>
                {triggeringTrip ? <><span className="spinner" /> Opening...</> : "⚡ Trigger Bazar Trip"}
              </button>
            </div>
          )}



          {/* Expenses split by month */}
          {(() => {
            const currentMonth = todayStr.slice(0, 7);
            const monthLabel = new Date(todayStr + "T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" });
            const thisMonth = expenses.filter((e) => e.date.startsWith(currentMonth));
            const past = expenses.filter((e) => !e.date.startsWith(currentMonth));
            return (
              <>
                {thisMonth.length > 0 && (
                  <div className="card">
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.875rem" }}>
                      {monthLabel} Expenses
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {thisMonth.map((e, i) => (
                        <ExpenseRow key={e.id} expense={e} isLast={i === thisMonth.length - 1} />
                      ))}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <PastExpensesCard expenses={past} />
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
