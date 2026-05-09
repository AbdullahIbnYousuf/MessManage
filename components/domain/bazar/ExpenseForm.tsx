"use client";

import { useState } from "react";
import { today } from "@/lib/utils/dates";

interface Props {
  onSubmitted: () => void;
}

export default function ExpenseForm({ onSubmitted }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        }),
      });
      const json = await res.json() as { error?: string; data?: { date: string } };
      if (!res.ok) {
        setError(json.error ?? "Failed to submit expense.");
      } else {
        // Reset form and notify parent
        setAmount("");
        setNote("");
        setDate(today());
        onSubmitted();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "1rem" }}>
        Submit Bazar Expense
      </div>
      <div
        className="badge badge-warning"
        style={{ marginBottom: "1rem", display: "inline-flex" }}
      >
        ⚠ Submitting will close the active trip
      </div>

      <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
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
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Note */}
        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Note <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g. Vegetables, fish, oil..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
          disabled={loading}
          style={{ alignSelf: "flex-start" }}
        >
          {loading ? <><span className="spinner" /> Submitting...</> : "Submit & Close Trip"}
        </button>
      </form>
    </div>
  );
}
