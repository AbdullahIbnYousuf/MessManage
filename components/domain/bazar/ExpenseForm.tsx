"use client";

import { useState } from "react";
import { formatNumericDate } from "@/lib/utils/dates";

interface Props {
  onSubmitted: () => void;
  tripNotes?: string | null;
  todayStr: string;
}

export default function ExpenseForm({ onSubmitted, tripNotes, todayStr }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr);
  const [isInstant, setIsInstant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleInitialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) < 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bazar/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount) || 0,
          note: note.trim() || undefined,
          date,
          isInstant,
        }),
      });
      const json = await res.json() as { error?: string; data?: { date: string } };
      if (!res.ok) {
        setError(json.error ?? "Failed to submit expense.");
      } else {
        // Reset form and notify parent
        setAmount("");
        setNote("");
        setDate(todayStr);
        setIsInstant(false);
        setConfirming(false);
        onSubmitted();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card bazar-expense-form" aria-labelledby="bazar-expense-title">
      <div className="meal-card-heading">
        <div>
          <h2 id="bazar-expense-title">Record bazar expense</h2>
          <p>Complete the active trip with the final amount and purchase details.</p>
        </div>
      </div>

      <fieldset className="bazar-trip-type">
        <legend>What kind of trip was this?</legend>
        <button
          type="button"
          onClick={() => setIsInstant(false)}
          className={!isInstant ? "is-selected" : undefined}
        >
          <strong>Regular trip</strong>
          <span>Counts as 1 trip</span>
        </button>
        <button
          type="button"
          onClick={() => setIsInstant(true)}
          className={isInstant ? "is-selected is-instant" : undefined}
        >
          <strong>Quick run</strong>
          <span>Counts as 0.1 trip</span>
        </button>
      </fieldset>

      {isInstant && (
        <div className="notice bazar-form-notice notice-warning">
          Quick run selected — this counts as <strong>0.1 trip</strong> in household contributions.
        </div>
      )}
      
      <div style={{
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: "var(--radius-md)",
        padding: "0.625rem 0.75rem",
        fontSize: "0.8125rem",
        color: "var(--color-warning)",
        marginBottom: "1rem",
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-start",
      }}>
        <span style={{ flexShrink: 0 }}>⚠️</span>
        <span><strong>Double-check your amount before submitting.</strong> Once submitted, you can only edit this <strong>today</strong>. After midnight it is locked permanently. Submitting will close the active trip.</span>
      </div>

      {confirming ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "1rem", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", color: "var(--color-warning)" }}>Is it OK to submit?</h3>
            <div style={{ marginBottom: "0.5rem" }}>
              <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Trip Type: </span>
              <span style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: isInstant ? "var(--color-warning)" : "var(--color-primary)",
              }}>
                {isInstant ? "⚡ Instant (0.1 trip)" : "🛒 Regular (1 trip)"}
              </span>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Expense Amount: </span>
              <strong style={{ fontSize: "1.125rem", color: "var(--color-success)" }}>৳{parseFloat(amount).toLocaleString()}</strong>
            </div>
            {note && (
              <div style={{ marginBottom: "0.5rem" }}>
                <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Expense Note: </span>
                <span style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", display: "block", marginTop: "0.25rem" }}>{note}</span>
              </div>
            )}
            <div style={{ marginBottom: "0.5rem" }}>
              <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>Date: </span>
              <span style={{ fontSize: "0.875rem" }}>{formatNumericDate(date)}</span>
            </div>
            {tripNotes && (
              <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--color-border-subtle)" }}>
                <span className="text-secondary" style={{ fontSize: "0.8125rem", display: "block", marginBottom: "0.25rem" }}>Bazar List / General Note: </span>
                <div style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", background: "var(--color-bg-surface)", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}>
                  {tripNotes}
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div style={{ background: "var(--color-danger-glow)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "0.625rem 0.875rem", color: "var(--color-danger)", fontSize: "0.875rem" }}>
              {error}
            </div>
          )}
          
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={loading}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={loading}>
              {loading ? <><span className="spinner" /> Submitting...</> : "Yes, Submit"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleInitialSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Amount */}
        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Amount (৳) <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>— enter 0 if you spent nothing</span>
          </label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Date */}
        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Date <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>— can backdate within this month</span>
          </label>
          <input
            className="input"
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Note <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            className="input"
            placeholder="e.g. Vegetables, fish, oil..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {error && (
          <div
            style={{
              background: "var(--color-danger-glow)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--radius-md)",
              padding: "0.625rem 0.875rem",
              color: "var(--color-danger)",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ alignSelf: "flex-start" }}
        >
          Check & Submit
        </button>
      </form>
      )}
    </section>
  );
}
