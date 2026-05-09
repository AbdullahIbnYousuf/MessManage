"use client";

import { useState, useCallback } from "react";
import { today } from "@/lib/utils/dates";

interface MealRecord {
  id: string;
  date: string;
  mealCount: number;
  isLocked: boolean;
}

interface Props {
  records: MealRecord[];
  deadlinePassed: boolean;
  editRequestStatus: "pending" | "approved" | "rejected" | "expired" | null;
  onUpdate: (date: string, count: number) => void;
  onRequestEdit: () => void;
}

const DAYS_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MealCalendar({
  records,
  deadlinePassed,
  editRequestStatus,
  onUpdate,
  onRequestEdit,
}: Props) {
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const todayStr = today();

  const updateMeal = useCallback(
    async (date: string, count: number) => {
      setSavingDate(date);
      setErrors((e) => ({ ...e, [date]: "" }));
      try {
        const res = await fetch(`/api/meals/records/${date}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mealCount: count }),
        });
        const json = await res.json() as { error?: string };
        if (!res.ok) {
          setErrors((e) => ({ ...e, [date]: json.error ?? "Failed to update." }));
        } else {
          onUpdate(date, count);
        }
      } catch {
        setErrors((e) => ({ ...e, [date]: "Network error." }));
      } finally {
        setSavingDate(null);
      }
    },
    [onUpdate]
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

  return (
    <div className="card">
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Meal Calendar</div>
          <div className="text-secondary" style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
            Click +/− on today&apos;s cell to update your meal count.
          </div>
        </div>
        {/* Edit request panel for today after deadline */}
        {deadlinePassed && editRequestStatus === null && (
          <button className="btn btn-sm btn-secondary" onClick={onRequestEdit}>
            Request Edit
          </button>
        )}
        {editRequestStatus === "pending" && (
          <span className="badge badge-warning">Edit request pending</span>
        )}
        {editRequestStatus === "approved" && (
          <span className="badge badge-success">Edit approved — update your count</span>
        )}
        {editRequestStatus === "rejected" && (
          <span className="badge badge-danger">Edit request rejected</span>
        )}
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
        {DAYS_HEADER.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--color-text-muted)", fontWeight: 600, padding: "4px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
          {week.map((record, di) => {
            if (!record) {
              return <div key={di} />;
            }

            const isToday = record.date === todayStr;
            const isFuture = record.date > todayStr;
            const isPast = record.date < todayStr;
            const canEdit = isToday && (!deadlinePassed || editRequestStatus === "approved");
            const isSaving = savingDate === record.date;
            const err = errors[record.date];

            const dayNum = new Date(record.date + "T00:00:00").getDate();

            return (
              <div
                key={record.id}
                style={{
                  borderRadius: "8px",
                  padding: "6px 4px",
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
                }}
              >
                {/* Date number */}
                <div style={{ fontSize: "0.6875rem", color: isToday ? "var(--color-primary-light)" : "var(--color-text-muted)", fontWeight: isToday ? 700 : 400, marginBottom: "4px" }}>
                  {dayNum}
                </div>

                {/* Meal count */}
                {isSaving ? (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                  </div>
                ) : (
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: record.mealCount > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                    {record.mealCount}
                  </div>
                )}

                {/* Controls for editable days */}
                {canEdit && !isSaving && (
                  <div style={{ display: "flex", justifyContent: "center", gap: "2px", marginTop: "4px" }}>
                    <button
                      onClick={() => void updateMeal(record.date, Math.max(record.mealCount - 1, 0))}
                      style={{ width: 18, height: 18, borderRadius: "4px", background: "var(--color-bg-base)", border: "1px solid var(--color-border)", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >−</button>
                    <button
                      onClick={() => void updateMeal(record.date, record.mealCount + 1)}
                      style={{ width: 18, height: 18, borderRadius: "4px", background: "var(--color-primary)", border: "none", cursor: "pointer", color: "white", fontSize: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >+</button>
                  </div>
                )}

                {/* Lock icon for locked past records */}
                {record.isLocked && (
                  <div style={{ position: "absolute", top: 3, right: 4, fontSize: "0.5rem", color: "var(--color-text-muted)" }}>🔒</div>
                )}

                {err && (
                  <div style={{ fontSize: "0.5rem", color: "var(--color-danger)", marginTop: "2px" }} title={err}>!</div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        <span>🔒 Locked (past midnight)</span>
        <span style={{ color: "var(--color-primary-light)" }}>■ Today</span>
      </div>
    </div>
  );
}
