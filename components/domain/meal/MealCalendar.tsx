"use client";

import { useState, useCallback } from "react";

interface MealRecord {
  id: string;
  date: string;
  mealCount: number;
  isLocked: boolean;
}

interface Props {
  records: MealRecord[];
  deadlinePassed?: boolean;
  editRequestStatus?: "pending" | "approved" | "rejected" | "expired" | null;
  onSaveMeal: (date: string, count: number) => Promise<string | null>;
  canEditRecord: (record: MealRecord) => boolean;
  onRequestEdit?: () => void;
  deadline?: string;
  todayStr: string;
  title?: string;
  instruction?: string;
  showMemberEditRequest?: boolean;
  footerText?: string;
}

const DAYS_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MealCalendar({
  records,
  deadlinePassed = false,
  editRequestStatus = null,
  onSaveMeal,
  canEditRecord,
  onRequestEdit,
  deadline = "",
  todayStr,
  title = "Meal Calendar",
  instruction = "Tap +/− to update the meal count",
  showMemberEditRequest = true,
  footerText,
}: Props) {
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMeal = useCallback(
    async (date: string, count: number) => {
      setSavingDate(date);
      setSavedDate(null);
      setErrors((e) => ({ ...e, [date]: "" }));
      try {
        const error = await onSaveMeal(date, count);
        if (error) {
          setErrors((e) => ({ ...e, [date]: error }));
        } else {
          setSavedDate(date);
        }
      } catch {
        setErrors((e) => ({ ...e, [date]: "Network error." }));
      } finally {
        setSavingDate(null);
      }
    },
    [onSaveMeal]
  );

  // Group records into weeks for calendar layout
  const firstRecord = records[0];
  if (!firstRecord) return null;

  // Find day-of-week for the 1st of the month (0=Sun...6=Sat, convert to Mon-first)
  const firstDate = new Date(firstRecord.date + "T00:00:00");
  const firstDay = firstDate.getDay(); // 0=Sun
  const offset = (firstDay === 0 ? 6 : firstDay - 1); // Mon=0, Sun=6

  // Create calendar cells with leading empty slots
  const cells: Array<MealRecord | null> = [
    ...Array<null>(offset).fill(null),
    ...records,
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<MealRecord | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const formatTime = (time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    if (!h || !m) return time24;
    const hNum = parseInt(h, 10);
    const ampm = hNum >= 12 ? "PM" : "AM";
    const h12 = hNum % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // Calculate next lock day and time
  const getNextLockInfo = () => {
    const today = new Date(todayStr + "T00:00:00");
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const lockDay = deadlinePassed ? tomorrow : today;
    const dayName = lockDay.toLocaleDateString("en-US", { weekday: "long" });
    const lockTime = formatTime(deadline);
    
    if (deadlinePassed) {
      return `Locks tomorrow (${dayName}) at ${lockTime}`;
    } else {
      return `Locks today at ${lockTime}`;
    }
  };

  return (
    <div className="card">
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ flex: "1 1 auto", minWidth: "200px" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{title}</div>
          <div className="text-secondary" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
            {instruction}
          </div>
        </div>
        {/* Edit request panel for today after deadline */}
        {showMemberEditRequest && deadlinePassed && editRequestStatus === null && onRequestEdit && (
          <button className="btn btn-sm btn-secondary" onClick={onRequestEdit} style={{ flexShrink: 0, minHeight: 44 }}>
            Request Edit
          </button>
        )}
        {showMemberEditRequest && editRequestStatus === "pending" && (
          <span className="badge badge-warning" style={{ flexShrink: 0 }}>Edit request pending</span>
        )}
        {showMemberEditRequest && editRequestStatus === "approved" && (
          <span className="badge badge-success" style={{ flexShrink: 0 }}>Edit approved — update your count</span>
        )}
        {showMemberEditRequest && editRequestStatus === "rejected" && (
          <span className="badge badge-danger" style={{ flexShrink: 0 }}>Edit request rejected</span>
        )}
      </div>

      {/* Calendar container - NO horizontal scroll */}
      <div>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "3px" }}>
          {DAYS_HEADER.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--color-text-muted)", fontWeight: 600, padding: "6px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "3px" }}>
            {week.map((record, di) => {
              if (!record) {
                return <div key={di} />;
              }

              const isToday = record.date === todayStr;
              const isFuture = record.date > todayStr;
              const isPast = record.date < todayStr;
              const canEdit = canEditRecord(record);
              const isSaving = savingDate === record.date;
              const wasSaved = savedDate === record.date;
              const err = errors[record.date];

              const dayNum = new Date(record.date + "T00:00:00").getDate();

              return (
                <div
                  key={record.id}
                  style={{
                    borderRadius: "6px",
                    padding: "8px 4px",
                    textAlign: "center",
                    background: isToday
                      ? "var(--color-primary-glow)"
                      : isFuture
                      ? "var(--color-bg-elevated)"
                      : "var(--color-bg-surface)",
                    border: `1px solid ${
                      isToday
                        ? "rgba(59,130,246,0.4)"
                        : "var(--color-border-subtle)"
                    }`,
                    opacity: isPast && record.mealCount === 0 ? 0.5 : 1,
                    position: "relative",
                    minHeight: canEdit ? "132px" : "72px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Date number */}
                  <div style={{ fontSize: "0.6875rem", color: isToday ? "var(--color-primary-light)" : "var(--color-text-muted)", fontWeight: isToday ? 700 : 400 }}>
                    {dayNum}
                  </div>

                  {/* Meal count */}
                  {isSaving ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                      <span className="spinner" style={{ width: 16, height: 16 }} />
                    </div>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: "1.125rem", color: record.mealCount > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)", padding: "2px 0" }}>
                      {record.mealCount}
                    </div>
                  )}

                  {/* Controls for editable days - VERTICAL STACK */}
                  {canEdit && !isSaving && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "4px" }}>
                      <button
                        onClick={() => void updateMeal(record.date, record.mealCount + 1)}
                        style={{ 
                          width: "100%", 
                          minHeight: "44px",
                          borderRadius: "4px", 
                          background: "var(--color-primary)", 
                          border: "none", 
                          cursor: "pointer", 
                          color: "white", 
                          fontSize: "0.875rem", 
                          fontWeight: 600,
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          touchAction: "manipulation",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >+</button>
                      <button
                        onClick={() => void updateMeal(record.date, Math.max(record.mealCount - 1, 0))}
                        disabled={record.mealCount === 0}
                        style={{ 
                          width: "100%", 
                          minHeight: "44px",
                          borderRadius: "4px", 
                          background: record.mealCount === 0 ? "var(--color-bg-base)" : "var(--color-bg-elevated)", 
                          border: "1px solid var(--color-border)", 
                          cursor: record.mealCount === 0 ? "not-allowed" : "pointer", 
                          color: record.mealCount === 0 ? "var(--color-text-muted)" : "var(--color-text-secondary)", 
                          fontSize: "0.875rem", 
                          fontWeight: 600,
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          opacity: record.mealCount === 0 ? 0.5 : 1,
                          touchAction: "manipulation",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >−</button>
                    </div>
                  )}

                  {/* Lock icon for locked past records */}
                  {!canEdit && (record.isLocked || isPast) && (
                    <div style={{ position: "absolute", top: 4, right: 4, fontSize: "0.625rem", color: "var(--color-text-muted)" }}>🔒</div>
                  )}

                  {wasSaved && !err && (
                    <div style={{ position: "absolute", bottom: 4, right: 4, fontSize: "0.75rem", color: "var(--color-success)" }}>✓</div>
                  )}

                  {err && (
                    <div style={{ fontSize: "0.625rem", color: "var(--color-danger)", marginTop: "2px" }} title={err}>!</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {Object.values(errors).some(Boolean) && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(192,80,80,0.3)",
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            fontSize: "0.8125rem",
          }}
        >
          {Object.values(errors).find(Boolean)}
        </div>
      )}

      {/* Legend - with next lock info instead of "Today" */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        {showMemberEditRequest ? (
          <span>🔒 {getNextLockInfo()}</span>
        ) : footerText ? (
          <span>{footerText}</span>
        ) : null}
      </div>
    </div>
  );
}
