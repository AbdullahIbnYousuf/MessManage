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
    <section className="card meal-pattern" aria-labelledby="meal-pattern-title">
      <div className="meal-card-heading">
        <div>
        <h2 id="meal-pattern-title">Default meal pattern</h2>
        <p>
          Saving updates the editable remainder of this month and every day next month.
        </p>
        </div>
      </div>

      <div className="meal-pattern__grid">
        {DAYS.map(({ key, label }) => (
          <div className="meal-pattern__day" key={key}>
            <span>{label}</span>
            <div className="meal-pattern__stepper">
              <button
                type="button"
                onClick={() => setDay(key, Math.min(pattern[key] + 1, 5))}
                disabled={pattern[key] >= 5}
                aria-label={`Increase ${label} meal count`}
              >+</button>
              <strong className={pattern[key] === 0 ? "is-zero" : undefined}>{pattern[key]}</strong>
              <button
                type="button"
                onClick={() => setDay(key, Math.max(pattern[key] - 1, 0))}
                disabled={pattern[key] === 0}
                aria-label={`Decrease ${label} meal count`}
              >−</button>
            </div>
          </div>
          ))}
      </div>

      <div className="meal-pattern__actions">
        <button className="btn btn-primary" onClick={save} disabled={loading}>
          {loading ? <span className="spinner" /> : "Save Pattern"}
        </button>
        {success && <span className="badge badge-success">Saved!</span>}
        {error && <span className="text-negative" style={{ fontSize: "0.8125rem" }}>{error}</span>}
      </div>
    </section>
  );
}
