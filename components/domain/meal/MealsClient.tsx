"use client";

import { useState, useEffect, useCallback } from "react";
import MealCalendar from "@/components/domain/meal/MealCalendar";
import MealReminderSettings from "@/components/domain/meal/MealReminderSettings";
import PatternEditor from "@/components/domain/meal/PatternEditor";
import { isDeadlinePassed, formatMonthLabel } from "@/lib/utils/dates";
import type { MealPattern } from "@/types";

interface MealRecord {
  id: string;
  date: string;
  mealCount: number;
  isLocked: boolean;
}

interface MealsClientProps {
  deadline: string; // e.g. "22:00"
  year: number;
  month: number;
  todayStr: string; // passed from server so MOCK_CURRENT_TIME is respected
  isAdmin: boolean;
}

export default function MealsClient({ deadline, year, month, todayStr, isAdmin }: MealsClientProps) {
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [pattern, setPattern] = useState<MealPattern | null>(null);
  const [editRequestStatus, setEditRequestStatus] = useState<
    "pending" | "approved" | "rejected" | "expired" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

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

  const saveMeal = useCallback(async (date: string, count: number) => {
    try {
      const res = await fetch(`/api/meals/records/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealCount: count }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return json.error ?? "Failed to update.";

      setRecords((prev) =>
        prev.map((record) =>
          record.date === date ? { ...record, mealCount: count } : record
        )
      );
      return null;
    } catch {
      return "Network error.";
    }
  }, []);

  const canEditRecord = useCallback((record: MealRecord) => {
    const isToday = record.date === todayStr;
    const isFuture = record.date > todayStr;
    return isFuture || (
      isToday && (!deadlinePassed || editRequestStatus === "approved")
    );
  }, [deadlinePassed, editRequestStatus, todayStr]);

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

  async function handleCancelToday() {
    if (!confirm("Cancel all meals for today? This will set everyone's meal count to 0. This cannot be undone.")) return;
    setCancelling(true);
    setCancelError(null);
    setCancelSuccess(false);
    try {
      const res = await fetch("/api/meals/cancel-today", { method: "POST" });
      const json = await res.json() as { error?: string; data?: { cancelled: number } };
      if (!res.ok) {
        setCancelError(json.error ?? "Failed to cancel meals.");
      } else {
        setCancelSuccess(true);
        void load();
      }
    } catch {
      setCancelError("Network error.");
    } finally {
      setCancelling(false);
    }
  }

  const totalMeals = records.filter(r => {
    if (r.date < todayStr) return true;
    if (r.date === todayStr && deadlinePassed) return true;
    if (r.isLocked) return true;
    return false;
  }).reduce((s, r) => s + r.mealCount, 0);
  const monthName = formatMonthLabel(`${year}-${String(month).padStart(2, "0")}-01`);

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

          {/* Admin: Cancel today's meals */}
          {isAdmin && (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Cancel Today&apos;s Meals</div>
                <div className="text-muted" style={{ fontSize: "0.8125rem" }}>
                  Sets all members&apos; meal count to 0 for today. Use if cooking was cancelled.
                </div>
                {cancelError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>{cancelError}</div>}
                {cancelSuccess && <div style={{ color: "var(--color-success)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>All meals cancelled for today.</div>}
              </div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => void handleCancelToday()}
                disabled={cancelling}
                style={{ borderColor: "rgba(239,68,68,0.4)", color: "var(--color-danger)", flexShrink: 0 }}
              >
                {cancelling ? <span className="spinner" /> : "Cancel Today's Meals"}
              </button>
            </div>
          )}

          {/* Calendar */}
          <MealReminderSettings />

          <MealCalendar
            records={records}
            deadlinePassed={deadlinePassed}
            editRequestStatus={editRequestStatus}
            onSaveMeal={saveMeal}
            canEditRecord={canEditRecord}
            onRequestEdit={() => void handleRequestEdit()}
            deadline={deadline}
            todayStr={todayStr}
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
