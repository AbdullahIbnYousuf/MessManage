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
import type {
  MealCorrectionBatch,
  MealCorrectionContext,
  MealPattern,
} from "@/types";

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
  joinedDate: string;
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
  joinedDate,
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
  const [correctionBatch, setCorrectionBatch] = useState<MealCorrectionBatch | null>(null);
  const [correctionMonthSettled, setCorrectionMonthSettled] = useState(false);
  const [frozenCorrectionDates, setFrozenCorrectionDates] = useState<string[]>([]);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [draftMealCounts, setDraftMealCounts] = useState<Record<string, number>>({});
  const [reviewCorrectionsOpen, setReviewCorrectionsOpen] = useState(false);
  const [submittingCorrections, setSubmittingCorrections] = useState(false);
  const [loading, setLoading] = useState(true);
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
        fetch(`/api/meals/edit-request?month=${year}-${String(month).padStart(2, "0")}`),
      ]);

      const recJson = await recRes.json() as { data?: MealRecord[]; error?: string };
      const patJson = await patRes.json() as { data?: MealPattern; error?: string };
      const editJson = await editRes.json() as {
        data?: MealCorrectionContext;
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
      setCorrectionBatch(editJson.data?.batch ?? null);
      setCorrectionMonthSettled(editJson.data?.monthSettled ?? false);
      setFrozenCorrectionDates(editJson.data?.frozenDates ?? []);
      const legacyStatus = editJson.data?.legacyRequest?.status;
      setEditRequestStatus(
        legacyStatus === "pending"
        || legacyStatus === "approved"
        || legacyStatus === "rejected"
        || legacyStatus === "expired"
          ? legacyStatus
          : null
      );
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
    if (correctionMode) {
      if (
        isNextMonth
        || correctionMonthSettled
        || frozenCorrectionDates.includes(record.date)
        || record.date < joinedDate
        || record.date > todayStr
      ) return false;
      return record.date < todayStr || deadlinePassed;
    }
    if (isHistoricalMonth) return false;
    if (isNextMonth) return true;
    const isToday = record.date === todayStr;
    const isFuture = record.date > todayStr;
    return isFuture || (
      isToday && (!deadlinePassed || editRequestStatus === "approved")
    );
  }, [
    correctionMode,
    correctionMonthSettled,
    deadlinePassed,
    editRequestStatus,
    isHistoricalMonth,
    isNextMonth,
    frozenCorrectionDates,
    joinedDate,
    todayStr,
  ]);

  const saveVisibleMeal = useCallback(async (date: string, count: number) => {
    if (!correctionMode) return saveMeal(date, count);
    setDraftMealCounts((current) => ({ ...current, [date]: count }));
    return null;
  }, [correctionMode, saveMeal]);

  function startCorrections() {
    setDraftMealCounts({});
    setEditError(null);
    setCorrectionMode(true);
  }

  function cancelCorrections() {
    setDraftMealCounts({});
    setEditError(null);
    setCorrectionMode(false);
    setReviewCorrectionsOpen(false);
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

  const displayedRecords = useMemo(
    () => visibleRecords.map((record) => (
      Object.prototype.hasOwnProperty.call(draftMealCounts, record.date)
        ? { ...record, mealCount: draftMealCounts[record.date]! }
        : record
    )),
    [draftMealCounts, visibleRecords]
  );

  const draftChanges = useMemo(() => {
    const originalByDate = new Map(
      visibleRecords.map((record) => [record.date, record.mealCount])
    );
    return Object.entries(draftMealCounts)
      .map(([date, proposedMealCount]) => ({
        date,
        originalMealCount: originalByDate.get(date) ?? null,
        proposedMealCount,
      }))
      .filter((change) => (
        change.originalMealCount === null
        || change.originalMealCount !== change.proposedMealCount
      ))
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [draftMealCounts, visibleRecords]);
  const draftMealDelta = draftChanges.reduce(
    (total, change) => total + change.proposedMealCount - (change.originalMealCount ?? 0),
    0
  );

  async function submitCorrections() {
    setSubmittingCorrections(true);
    setEditError(null);
    try {
      const res = await fetch("/api/meals/edit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: `${year}-${String(month).padStart(2, "0")}`,
          changes: draftChanges.map((change) => ({
            date: change.date,
            mealCount: change.proposedMealCount,
          })),
        }),
      });
      const json = await res.json() as { data?: MealCorrectionBatch; error?: string };
      if (!res.ok || !json.data) {
        setEditError(json.error ?? "Could not submit meal corrections.");
        setReviewCorrectionsOpen(false);
        return;
      }
      setCorrectionBatch(json.data);
      setDraftMealCounts({});
      setCorrectionMode(false);
      setReviewCorrectionsOpen(false);
    } catch {
      setEditError("Network error. Please try again.");
      setReviewCorrectionsOpen(false);
    } finally {
      setSubmittingCorrections(false);
    }
  }

  const totalMeals = isHistoricalMonth || isNextMonth
    ? records.reduce((sum, record) => sum + record.mealCount, 0)
    : records.filter(record => {
        if (record.date < todayStr) return true;
        if (record.date === todayStr && deadlinePassed) return true;
        return record.isLocked;
      }).reduce((sum, record) => sum + record.mealCount, 0);
  const monthName = formatMonthLabel(`${year}-${String(month).padStart(2, "0")}-01`);
  const monthStatus = correctionMode
    ? "Correction draft"
    : isHistoricalMonth
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
  const hasRequestableDates = !isNextMonth && visibleRecords.some((record) => (
    !correctionMonthSettled
    && !frozenCorrectionDates.includes(record.date)
    && record.date >= joinedDate
    && (record.date < todayStr || (record.date === todayStr && deadlinePassed))
  ));
  const correctionPending = correctionBatch?.status === "pending";
  const correctionStatusLabel = correctionBatch
    ? correctionBatch.status === "pending"
      ? "Waiting for admin review"
      : correctionBatch.status === "approved"
        ? "Corrections approved"
        : correctionBatch.status === "rejected"
          ? "Corrections rejected"
          : correctionBatch.status === "invalidated"
            ? "Request invalidated by finalized accounting"
            : "Request expired"
    : null;

  function goPreviousMonth() {
    if (!canGoPrevious) return;
    cancelCorrections();
    const previous = shiftCalendarMonth(year, month, -1);
    setYear(previous.year);
    setMonth(previous.month);
  }

  function goNextMonth() {
    if (!canGoNext) return;
    cancelCorrections();
    const next = shiftCalendarMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
  }

  function goToCurrentMonth() {
    cancelCorrections();
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

          {!isNextMonth && (
            <div className={`card meal-correction-toolbar${correctionMode ? " is-editing" : ""}`}>
              <div>
                <strong>{correctionMode ? "Correction draft" : "Need to fix an earlier meal?"}</strong>
                <span>
                  {correctionMode
                    ? `${draftChanges.length} ${draftChanges.length === 1 ? "change" : "changes"} prepared. Saved meal records stay unchanged until an admin approves.`
                    : correctionStatusLabel
                      ? `${correctionStatusLabel} · ${correctionBatch?.changes.length ?? 0} ${correctionBatch?.changes.length === 1 ? "change" : "changes"}`
                      : (correctionMonthSettled
                        ? "This month has been settled and is permanently read only."
                        : "Propose exact changes for this unsettled month and send them together for review.")}
                </span>
              </div>
              {correctionMode ? (
                <div className="meal-correction-toolbar__actions">
                  <button type="button" className="btn btn-secondary" onClick={cancelCorrections}>
                    Cancel draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={draftChanges.length === 0}
                    onClick={() => setReviewCorrectionsOpen(true)}
                  >
                    Review {draftChanges.length > 0 ? draftChanges.length : ""} changes
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!hasRequestableDates || correctionPending || editRequestStatus === "pending"}
                  onClick={startCorrections}
                >
                  {correctionPending ? "Request pending" : "Request corrections"}
                </button>
              )}
            </div>
          )}

          {/* Calendar */}
          <MealCalendar
            records={displayedRecords}
            deadlinePassed={isCurrentMonth && deadlinePassed}
            editRequestStatus={isCurrentMonth ? editRequestStatus : null}
            onSaveMeal={saveVisibleMeal}
            canEditRecord={canEditRecord}
            deadline={deadline}
            todayStr={todayStr}
            instruction={correctionMode
              ? "Tap protected dates and prepare the corrected counts before review"
              : isHistoricalMonth
              ? "Review the stored meal counts for this month"
              : isNextMonth
                ? "Tap a day to adjust next month’s saved schedule"
                : "Tap a day, then use +/− to update the meal count"}
            showMemberEditRequest={isCurrentMonth && !correctionMode}
            allowMissingEdit={correctionMode}
            footerText={correctionMode
              ? "Draft changes have no accounting effect until the complete request is approved."
              : isHistoricalMonth
              ? "Historical meals are view only. Missing records are shown as Not recorded."
              : isNextMonth
                ? "This schedule is saved from your weekly pattern and can be adjusted now."
                : undefined}
          />

          {/* Pattern editor */}
          {!isHistoricalMonth && !correctionMode && pattern !== null && (
            <PatternEditor
              initial={pattern}
              onSaved={(newPattern) => {
                setPattern(newPattern);
                void load();
              }}
            />
          )}

          <MealReminderSettings />

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
      <ConfirmDialog
        open={reviewCorrectionsOpen}
        title={`Send ${draftChanges.length} meal ${draftChanges.length === 1 ? "change" : "changes"}?`}
        description="The saved meals will not change until an admin approves this complete request."
        confirmLabel="Send for review"
        busy={submittingCorrections}
        onCancel={() => setReviewCorrectionsOpen(false)}
        onConfirm={() => void submitCorrections()}
      >
        <div className="meal-correction-summary">
          <ul>
            {draftChanges.map((change) => (
              <li key={change.date}>
                <span>{change.date}</span>
                <strong>
                  {change.originalMealCount === null ? "Not recorded" : change.originalMealCount}
                  {" → "}{change.proposedMealCount}
                </strong>
              </li>
            ))}
          </ul>
          <div>
            <span>Total difference</span>
            <strong>
              {draftMealDelta > 0 ? "+" : ""}{draftMealDelta} meals
            </strong>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
