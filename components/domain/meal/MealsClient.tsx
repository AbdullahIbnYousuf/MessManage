"use client";

import { useState, useEffect, useCallback } from "react";
import MealCalendar from "@/components/domain/meal/MealCalendar";
import PatternEditor from "@/components/domain/meal/PatternEditor";
import { isDeadlinePassed } from "@/lib/utils/dates";
import type { MealPattern } from "@/types";

interface MealRecord {
  id: string;
  date: string;
  mealCount: number;
  isLocked: boolean;
}

interface MealsClientProps {
  deadline: string; // e.g. "22:00"
}

export default function MealsClient({ deadline }: MealsClientProps) {
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [pattern, setPattern] = useState<MealPattern | null>(null);
  const [editRequestStatus, setEditRequestStatus] = useState<
    "pending" | "approved" | "rejected" | "expired" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const deadlinePassed = isDeadlinePassed(deadline);

  const load = useCallback(async () => {
    setLoading(true);
    const [recRes, patRes, editRes] = await Promise.all([
      fetch(`/api/meals/records?year=${year}&month=${month}`),
      fetch("/api/meals/pattern"),
      fetch("/api/meals/edit-request"),
    ]);

    const recJson = await recRes.json() as { data?: MealRecord[] };
    const patJson = await patRes.json() as { data?: MealPattern };
    const editJson = await editRes.json() as { data?: { status: "pending" | "approved" | "rejected" | "expired" } | null };

    setRecords(recJson.data ?? []);
    setPattern(patJson.data ?? null);
    setEditRequestStatus(editJson.data?.status ?? null);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { void load(); }, [load]);

  function handleUpdate(date: string, count: number) {
    setRecords((prev) =>
      prev.map((r) => (r.date === date ? { ...r, mealCount: count } : r))
    );
  }

  async function handleRequestEdit() {
    setRequestingEdit(true);
    setEditError(null);
    try {
      const res = await fetch("/api/meals/edit-request", { method: "POST" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setEditError(json.error ?? "Failed to submit request.");
      } else {
        setEditRequestStatus("pending");
      }
    } catch {
      setEditError("Network error.");
    } finally {
      setRequestingEdit(false);
    }
  }

  const totalMeals = records.reduce((s, r) => s + r.mealCount, 0);
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          My Meals
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
          {monthName} · {totalMeals} meals recorded
          {deadlinePassed
            ? " · Deadline passed for today"
            : ` · Deadline: ${deadline}`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Edit error banner */}
          {editError && (
            <div
              style={{
                background: "var(--color-danger-glow)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 1rem",
                color: "var(--color-danger)",
                fontSize: "0.875rem",
              }}
            >
              {editError}
            </div>
          )}

          {/* Calendar */}
          <MealCalendar
            records={records}
            deadlinePassed={deadlinePassed}
            editRequestStatus={editRequestStatus}
            onUpdate={handleUpdate}
            onRequestEdit={() => void handleRequestEdit()}
            deadline={deadline}
          />

          {/* Pattern editor */}
          {pattern !== null && (
            <PatternEditor
              initial={pattern}
              onSaved={(newPattern) => setPattern(newPattern)}
            />
          )}

          {/* Submit request loading state */}
          {requestingEdit && (
            <div className="text-secondary" style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="spinner" /> Submitting edit request...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
