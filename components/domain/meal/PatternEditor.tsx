"use client";

import { useState } from "react";
import type { MealPattern } from "@/types";

const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;

interface Props {
  initial: MealPattern;
  onSaved: (pattern: MealPattern) => void;
}

export default function PatternEditor({ initial, onSaved }: Props) {
  const [pattern, setPattern] = useState<MealPattern>(initial);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDay(day: keyof MealPattern, value: number) {
    setPattern((p) => ({ ...p, [day]: value }));
    setSuccess(false);
  }

  async function save() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/meals/pattern", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pattern),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to save.");
      } else {
        setSuccess(true);
        onSaved(pattern);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Default Meal Pattern</div>
        <div className="text-secondary" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
          Set how many meals you take each day of the week. Changes apply to all future days this month.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.5rem",
          marginBottom: "1.25rem",
        }}
      >
        {DAYS.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
              {label}
            </span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              {/* Increment */}
              <button
                onClick={() => setDay(key, Math.min(pattern[key] + 1, 5))}
                style={{
                  width: 32, height: 24,
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px 6px 0 0",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.1s",
                }}
              >▲</button>

              {/* Value display */}
              <div
                style={{
                  width: 32, height: 36,
                  background: pattern[key] > 0 ? "var(--color-primary-glow)" : "var(--color-bg-elevated)",
                  border: `1px solid ${pattern[key] > 0 ? "rgba(59,130,246,0.4)" : "var(--color-border)"}`,
                  borderTop: "none", borderBottom: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: pattern[key] > 0 ? "var(--color-primary-light)" : "var(--color-text-muted)",
                }}
              >
                {pattern[key]}
              </div>

              {/* Decrement */}
              <button
                onClick={() => setDay(key, Math.max(pattern[key] - 1, 0))}
                style={{
                  width: 32, height: 24,
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0 0 6px 6px",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.1s",
                }}
              >▼</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={loading}>
          {loading ? <span className="spinner" /> : "Save Pattern"}
        </button>
        {success && <span className="badge badge-success">Saved!</span>}
        {error && <span className="text-negative" style={{ fontSize: "0.8125rem" }}>{error}</span>}
      </div>
    </div>
  );
}
