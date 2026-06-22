"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MealCalendar from "@/components/domain/meal/MealCalendar";
import { formatMonthLabel } from "@/lib/utils/dates";
import type { AdminMealCalendarRecord } from "@/types";

type AdminMealCalendarData = {
  member: {
    id: string;
    name: string;
    avatarUrl: string | null;
    status: "active" | "deactivated";
  };
  month: string;
  isSettled: boolean;
  records: AdminMealCalendarRecord[];
};

type Props = {
  memberId: string;
  initialYear: number;
  initialMonth: number;
  todayStr: string;
};

function previousMonth(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

function nextMonth(year: number, month: number) {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

export default function AdminMemberMealsClient({
  memberId,
  initialYear,
  initialMonth,
  todayStr,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<AdminMealCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/members/${memberId}/meals?year=${year}&month=${month}`
      );
      const json = await response.json() as {
        data?: AdminMealCalendarData;
        error?: string;
      };
      if (!response.ok || !json.data) {
        setData(null);
        setError(json.error ?? "Could not load the member calendar.");
        return;
      }
      setData(json.data);
    } catch {
      setData(null);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [memberId, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMeal = useCallback(async (date: string, mealCount: number) => {
    try {
      const response = await fetch(
        `/api/admin/members/${memberId}/meals/${date}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mealCount }),
        }
      );
      const json = await response.json() as { error?: string };
      if (!response.ok) return json.error ?? "Could not update this meal.";

      setData((current) => current ? {
        ...current,
        records: current.records.map((record) =>
          record.date === date ? { ...record, mealCount } : record
        ),
      } : current);
      return null;
    } catch {
      return "Network error. Please try again.";
    }
  }, [memberId]);

  const canEditRecord = useCallback(
    (record: {
      id: string;
      date: string;
      mealCount: number;
      isLocked: boolean;
      canEdit?: boolean;
    }) => record.canEdit === true,
    []
  );

  const isCurrentMonth = year === initialYear && month === initialMonth;
  const protectedCounts = useMemo(() => {
    const records = data?.records ?? [];
    return {
      bulk: records.filter(
        (record) => record.blockReason === "finished_bulk_cycle"
      ).length,
      membership: records.filter(
        (record) =>
          record.blockReason === "before_joining" ||
          record.blockReason === "after_deactivation"
      ).length,
    };
  }, [data]);

  function goPrevious() {
    const value = previousMonth(year, month);
    setYear(value.year);
    setMonth(value.month);
  }

  function goNext() {
    if (isCurrentMonth) return;
    const value = nextMonth(year, month);
    setYear(value.year);
    setMonth(value.month);
  }

  const footerText = data?.isSettled
    ? "🔒 This month is settled and read-only."
    : protectedCounts.bulk > 0
      ? "🔒 Some dates are protected by finished bulk-cycle allocations."
      : protectedCounts.membership > 0
        ? "🔒 Dates outside this member’s active period are read-only."
        : "Admin corrections save immediately. Past records remain locked for members.";

  return (
    <div className="page-container">
      <div style={{ marginBottom: "1rem" }}>
        <Link
          href="/admin/members"
          className="btn btn-ghost btn-sm"
          style={{ minHeight: 44, paddingLeft: 0 }}
        >
          ← Back to Members
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Edit Member Meals
          </h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Correct individual daily counts without changing the weekly pattern.
          </p>
        </div>

        {data && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem" }}>
            {data.member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.member.avatarUrl}
                alt={data.member.name}
                className="avatar avatar-md"
              />
            ) : (
              <div className="avatar-fallback avatar-md">
                {data.member.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{data.member.name}</div>
              <div className="text-muted" style={{ fontSize: "0.75rem", textTransform: "capitalize" }}>
                {data.member.status}
              </div>
            </div>
            <span className={data.member.status === "active" ? "badge badge-success" : "badge badge-danger"}>
              {data.member.status}
            </span>
          </div>
        )}

        <div
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "44px minmax(0, 1fr) 44px",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            aria-label="Previous month"
            onClick={goPrevious}
            style={{ width: 44, minHeight: 44, padding: 0 }}
          >
            ←
          </button>
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>
              {formatMonthLabel(`${year}-${String(month).padStart(2, "0")}`)}
            </div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
              {data?.isSettled ? "Settled · view only" : "Unsettled"}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            aria-label="Next month"
            onClick={goNext}
            disabled={isCurrentMonth}
            style={{ width: 44, minHeight: 44, padding: 0 }}
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : error || !data ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <div className="text-negative" style={{ marginBottom: "1rem" }}>
            {error ?? "Could not load the member calendar."}
          </div>
          <button className="btn btn-secondary" onClick={() => void load()} style={{ minHeight: 44 }}>
            Try Again
          </button>
        </div>
      ) : (
        <MealCalendar
          records={data.records}
          onSaveMeal={saveMeal}
          canEditRecord={canEditRecord}
          todayStr={todayStr}
          title={`${data.member.name}’s Meal Calendar`}
          instruction="Tap +/− to save an admin correction immediately"
          showMemberEditRequest={false}
          footerText={footerText}
        />
      )}
    </div>
  );
}
