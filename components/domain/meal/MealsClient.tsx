"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import MealCalendar from "@/components/domain/meal/MealCalendar";
import MealReminderSettings from "@/components/domain/meal/MealReminderSettings";
import PatternEditor from "@/components/domain/meal/PatternEditor";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/Editorial";
import {
  allDaysInMonth,
  compareCalendarMonths,
  formatMonthLabel,
  isDeadlinePassed,
  shiftCalendarMonth,
} from "@/lib/utils/dates";
import type { MealPattern } from "@/types";

interface MealRecord {
  id: string;
  date: string;
  mealCount: number;
  isLocked: boolean;
}

interface MealsClientProps {
  deadline: string; // e.g. "22:00"
  initialYear: number;
  initialMonth: number;
  earliestYear: number;
  earliestMonth: number;
  todayStr: string; // passed from server so MOCK_CURRENT_TIME is respected
  isAdmin: boolean;
}

type CalendarRecord = Omit<MealRecord, "mealCount"> & {
  mealCount: number | null;
  isMissing?: boolean;
};

export default function MealsClient({
  deadline,
  initialYear,
  initialMonth,
  earliestYear,
  earliestMonth,
  todayStr,
  isAdmin,
}: MealsClientProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
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
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequestId = useRef(0);

  const deadlinePassed = isDeadlinePassed(deadline);
  const currentMonth = useMemo(
    () => ({ year: initialYear, month: initialMonth }),
    [initialMonth, initialYear]
  );
  const selectedMonth = useMemo(() => ({ year, month }), [month, year]);
  const earliestCalendarMonth = useMemo(
    () => ({ year: earliestYear, month: earliestMonth }),
    [earliestMonth, earliestYear]
  );
  const monthRelation = compareCalendarMonths(selectedMonth, currentMonth);
  const isHistoricalMonth = monthRelation < 0;
  const isCurrentMonth = monthRelation === 0;
  const isNextMonth = monthRelation === 1;

  const load = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [recRes, patRes, editRes] = await Promise.all([
        fetch(`/api/meals/records?year=${year}&month=${month}`),
        fetch("/api/meals/pattern"),
        fetch("/api/meals/edit-request"),
      ]);

      const recJson = await recRes.json() as { data?: MealRecord[]; error?: string };
      const patJson = await patRes.json() as { data?: MealPattern; error?: string };
      const editJson = await editRes.json() as {
        data?: { status: "pending" | "approved" | "rejected" | "expired" } | null;
        error?: string;
      };

      if (!recRes.ok || !patRes.ok || !editRes.ok) {
        throw new Error(
          recJson.error ?? patJson.error ?? editJson.error ?? "Could not load meals."
        );
      }

      if (requestId !== loadRequestId.current) return;

      setRecords(recJson.data ?? []);
      setPattern(patJson.data ?? null);
      setEditRequestStatus(editJson.data?.status ?? null);
    } catch (error) {
      if (requestId !== loadRequestId.current) return;
      setRecords([]);
      setLoadError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
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

  const canEditRecord = useCallback((record: CalendarRecord) => {
    if (isHistoricalMonth) return false;
    if (isNextMonth) return true;
    const isToday = record.date === todayStr;
    const isFuture = record.date > todayStr;
    return isFuture || (
      isToday && (!deadlinePassed || editRequestStatus === "approved")
    );
  }, [deadlinePassed, editRequestStatus, isHistoricalMonth, isNextMonth, todayStr]);

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
    setConfirmCancelOpen(false);
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

  const visibleRecords = useMemo<CalendarRecord[]>(() => {
    if (!isHistoricalMonth) return records;

    const storedByDate = new Map(records.map((record) => [record.date, record]));
    return allDaysInMonth(year, month).map((date) => {
      const stored = storedByDate.get(date);
      return stored ?? {
        id: `missing-${date}`,
        date,
        mealCount: null,
        isLocked: true,
        isMissing: true,
      };
    });
  }, [isHistoricalMonth, month, records, year]);

  const totalMeals = isHistoricalMonth || isNextMonth
    ? records.reduce((sum, record) => sum + record.mealCount, 0)
    : records.filter(record => {
        if (record.date < todayStr) return true;
        if (record.date === todayStr && deadlinePassed) return true;
        return record.isLocked;
      }).reduce((sum, record) => sum + record.mealCount, 0);
  const monthName = formatMonthLabel(`${year}-${String(month).padStart(2, "0")}-01`);
  const monthStatus = isHistoricalMonth
    ? "History · View only"
    : isNextMonth
      ? "Next month · Scheduled"
      : "Current month";
  const summaryDescription = loading
    ? `Loading ${monthName}…`
    : isHistoricalMonth
      ? `${totalMeals} meals recorded in ${monthName}`
      : isNextMonth
        ? `${totalMeals} meals currently scheduled`
        : `${totalMeals} meals recorded · ${deadlinePassed ? "Today’s deadline has passed" : `Changes close at ${deadline}`}`;
  const canGoPrevious = compareCalendarMonths(selectedMonth, earliestCalendarMonth) > 0;
  const canGoNext = monthRelation < 1;

  function goPreviousMonth() {
    if (!canGoPrevious) return;
    const previous = shiftCalendarMonth(year, month, -1);
    setYear(previous.year);
    setMonth(previous.month);
  }

  function goNextMonth() {
    if (!canGoNext) return;
    const next = shiftCalendarMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
  }

  function goToCurrentMonth() {
    setYear(initialYear);
    setMonth(initialMonth);
  }

  return (
    <div className="page-container">
      <PageHeader
        eyebrow={monthStatus}
        title="My meals"
        description={summaryDescription}
      />

      <div className="meal-month-nav" aria-label="Meal calendar month navigation">
        <button
          type="button"
          className="btn btn-secondary meal-month-nav__arrow"
          onClick={goPreviousMonth}
          disabled={!canGoPrevious}
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="meal-month-nav__label" aria-live="polite">
          <strong>{monthName}</strong>
          <span>{monthStatus}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary meal-month-nav__arrow"
          onClick={goNextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
        >
          →
        </button>
        <button
          type="button"
          className="btn btn-ghost meal-month-nav__today"
          onClick={goToCurrentMonth}
          disabled={isCurrentMonth}
        >
          Today
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : loadError ? (
        <div className="card meal-load-error" role="alert">
          <div>
            <strong>Could not load {monthName}</strong>
            <span>{loadError}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
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
          {isAdmin && isCurrentMonth && (
            <div className="card meal-admin-notice">
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
                onClick={() => setConfirmCancelOpen(true)}
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
            records={visibleRecords}
            deadlinePassed={isCurrentMonth && deadlinePassed}
            editRequestStatus={isCurrentMonth ? editRequestStatus : null}
            onSaveMeal={saveMeal}
            canEditRecord={canEditRecord}
            onRequestEdit={isCurrentMonth ? () => void handleRequestEdit() : undefined}
            deadline={deadline}
            todayStr={todayStr}
            instruction={isHistoricalMonth
              ? "Review the stored meal counts for this month"
              : isNextMonth
                ? "Tap a day to adjust next month’s saved schedule"
                : "Tap a day, then use +/− to update the meal count"}
            showMemberEditRequest={isCurrentMonth}
            footerText={isHistoricalMonth
              ? "Historical meals are view only. Missing records are shown as Not recorded."
              : isNextMonth
                ? "This schedule is saved from your weekly pattern and can be adjusted now."
                : undefined}
          />

          {/* Pattern editor */}
          {!isHistoricalMonth && pattern !== null && (
            <PatternEditor
              initial={pattern}
              onSaved={(newPattern) => {
                setPattern(newPattern);
                void load();
              }}
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
      <ConfirmDialog
        open={confirmCancelOpen}
        title="Cancel all meals for today?"
        description="This will set everyone's meal count to 0. This cannot be undone."
        confirmLabel="Cancel today’s meals"
        tone="danger"
        busy={cancelling}
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => void handleCancelToday()}
      />
    </div>
  );
}
