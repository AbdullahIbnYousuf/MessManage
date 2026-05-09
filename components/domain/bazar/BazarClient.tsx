"use client";

import { useState, useEffect, useCallback } from "react";
import ActiveTripCard from "@/components/domain/bazar/ActiveTripCard";
import ExpenseForm from "@/components/domain/bazar/ExpenseForm";

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
  totalSpend: string;
}

export default function BazarClient() {
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

          {/* Active trip */}
          {trip ? (
            <>
              <ActiveTripCard
                trip={trip}
                onNotesUpdated={(notes) => setTrip((t) => t ? { ...t, shoppingNotes: notes } : t)}
              />
              <ExpenseForm onSubmitted={handleExpenseSubmitted} />
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

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Bazar Leaderboard</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {leaderboard.map((entry, i) => (
                  <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: i < leaderboard.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", width: 20, textAlign: "center", fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    {entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.avatarUrl} alt={entry.name} className="avatar avatar-sm" />
                    ) : (
                      <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>{entry.name.charAt(0)}</div>
                    )}
                    <span style={{ flex: 1, fontWeight: 500, fontSize: "0.875rem" }}>{entry.name}</span>
                    <span className="badge badge-primary">{entry.visits} trips</span>
                    <span style={{ fontSize: "0.875rem", color: "var(--color-success)", fontWeight: 600, minWidth: 80, textAlign: "right" }}>
                      ৳{parseFloat(entry.totalSpend).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent expenses */}
          {expenses.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>Recent Expenses</div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {e.userAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={e.userAvatar} alt={e.userName} className="avatar avatar-sm" />
                            ) : (
                              <div className="avatar-fallback" style={{ width: 24, height: 24, fontSize: "0.6875rem" }}>{e.userName.charAt(0)}</div>
                            )}
                            <span style={{ fontSize: "0.875rem" }}>{e.userName}</span>
                          </div>
                        </td>
                        <td className="text-secondary" style={{ fontSize: "0.8125rem" }}>{e.date}</td>
                        <td style={{ fontWeight: 600, color: "var(--color-success)" }}>৳{parseFloat(e.amount).toLocaleString()}</td>
                        <td className="text-secondary" style={{ fontSize: "0.8125rem" }}>{e.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
