"use client";

import { useState, useCallback, useEffect } from "react";

interface MealRecord {
  id: string;
  date: string;
  mealCount: number | null;
  isLocked: boolean;
  isMissing?: boolean;
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
  allowMissingEdit?: boolean;
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
  instruction = "Tap a day, then use +/− to update the meal count",
  showMemberEditRequest = true,
  footerText,
  allowMissingEdit = false,
}: Props) {
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const visibleMonth = records[0]?.date.slice(0, 7) ?? "";
  useEffect(() => {
    if (!visibleMonth) return;
    setSelectedDate(
      todayStr.startsWith(`${visibleMonth}-`) ? todayStr : `${visibleMonth}-01`
    );
    setSavedDate(null);
    setErrors({});
  }, [todayStr, visibleMonth]);

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

  const selectedRecord = records.find((record) => record.date === selectedDate) ?? firstRecord;
  const selectedCanEdit = canEditRecord(selectedRecord);
  const selectedMealCount = selectedRecord.mealCount ?? 0;
  const selectedLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${selectedRecord.date}T00:00:00`));

  return (
    <section className="card meal-calendar" aria-labelledby="meal-calendar-title">
      <div className="meal-card-heading">
        <div>
          <h2 id="meal-calendar-title">{title}</h2>
          <p>{instruction}</p>
        </div>
        {showMemberEditRequest && deadlinePassed && editRequestStatus === null && onRequestEdit && (
          <button className="btn btn-secondary" onClick={onRequestEdit}>
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

      <div className="meal-calendar__grid" aria-label="Monthly meal calendar">
        <div className="meal-calendar__weekdays" aria-hidden="true">
          {DAYS_HEADER.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div className="meal-calendar__week" key={wi}>
            {week.map((record, di) => {
              if (!record) {
                return <span key={di} aria-hidden="true" />;
              }

              const isToday = record.date === todayStr;
              const isFuture = record.date > todayStr;
              const isPast = record.date < todayStr;
              const canEdit = canEditRecord(record);
              const isSaving = savingDate === record.date;
              const wasSaved = savedDate === record.date;
              const err = errors[record.date];
              const dayNum = new Date(record.date + "T00:00:00").getDate();
              const mealLabel = record.isMissing && record.mealCount === null
                ? "not recorded"
                : `${record.mealCount ?? 0} meals`;

              return (
                <button
                  type="button"
                  key={record.id}
                  className={`meal-calendar__day${isToday ? " is-today" : ""}${isFuture ? " is-future" : ""}${isPast ? " is-past" : ""}${selectedRecord.id === record.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedDate(record.date)}
                  aria-pressed={selectedRecord.id === record.id}
                  aria-label={`${record.date}: ${mealLabel}${canEdit ? ", editable" : ", locked"}`}
                >
                  <span className="meal-calendar__date">{dayNum}</span>
                  {isSaving ? (
                    <span className="spinner meal-calendar__spinner" />
                  ) : record.isMissing && record.mealCount === null ? (
                    <span className="meal-calendar__missing">—</span>
                  ) : (
                    <strong className={record.mealCount === 0 ? "is-zero" : undefined}>{record.mealCount}</strong>
                  )}
                  {!canEdit && (record.isLocked || isPast) && (
                    <span className="meal-calendar__lock" aria-hidden="true">•</span>
                  )}
                  {wasSaved && !err && (
                    <span className="meal-calendar__saved" aria-label="Saved">✓</span>
                  )}
                  {err && (
                    <span className="meal-calendar__error" title={err} aria-label="Save failed">!</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className={`meal-day-editor${selectedCanEdit ? "" : " is-locked"}`}>
        <div className="meal-day-editor__copy">
          <span>{selectedLabel}</span>
          <strong>
            {selectedRecord.isMissing && selectedRecord.mealCount === null
              ? "No meal record was stored"
              : selectedCanEdit
                ? "Adjust this day"
                : "This day can’t be changed here"}
          </strong>
        </div>
        {selectedCanEdit && (selectedRecord.mealCount !== null || allowMissingEdit) && (
          <div className="meal-day-editor__controls" aria-label={`Meal count for ${selectedLabel}`}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void updateMeal(selectedRecord.date, Math.max(selectedMealCount - 1, 0))}
              disabled={selectedMealCount === 0 || savingDate === selectedRecord.date}
              aria-label="Decrease meal count"
            >−</button>
            <strong aria-live="polite">{selectedMealCount}</strong>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void updateMeal(selectedRecord.date, selectedMealCount + 1)}
              disabled={savingDate === selectedRecord.date}
              aria-label="Increase meal count"
            >+</button>
          </div>
        )}
      </div>

      {Object.values(errors).some(Boolean) && (
        <div className="notice notice-danger" role="alert">
          {Object.values(errors).find(Boolean)}
        </div>
      )}

      <div className="meal-calendar__footer">
        {showMemberEditRequest ? (
          <span>{getNextLockInfo()}</span>
        ) : footerText ? (
          <span>{footerText}</span>
        ) : null}
      </div>
    </section>
  );
}
