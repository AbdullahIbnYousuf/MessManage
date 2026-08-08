"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ActiveTripCard from "@/components/domain/bazar/ActiveTripCard";
import {
  attentionPresentation,
  formatHomeDate,
  mealStatePresentation,
} from "@/components/domain/dashboard/presentation";
import NavIcon from "@/components/navigation/NavIcon";
import { formatTaka } from "@/lib/utils/decimal";
import type { HomeSummary } from "@/types/home";

function HomeSkeleton() {
  return (
    <div className="home-stack" aria-label="Loading Home summary">
      <div className="home-meals-card">
        <span className="skeleton" style={{ width: "48%", height: 24 }} />
        <span className="skeleton" style={{ width: "100%", height: 64 }} />
        <span className="skeleton" style={{ width: "100%", height: 52 }} />
        <span className="skeleton" style={{ width: "100%", height: 52 }} />
      </div>
      <span className="skeleton" style={{ width: "100%", height: 150 }} />
      <span className="skeleton" style={{ width: "100%", height: 120 }} />
      <div className="home-month-grid">
        {[0, 1, 2, 3].map((item) => (
          <span className="skeleton" style={{ width: "100%", height: 92 }} key={item} />
        ))}
      </div>
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar avatar-sm" src={avatarUrl} alt="" />;
  }
  return <span className="home-avatar-fallback" aria-hidden="true">{name.charAt(0)}</span>;
}

export default function DashboardClient() {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/home/summary", { cache: "no-store" });
      const payload = await response.json() as { data?: HomeSummary; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not load today’s household summary.");
      }
      setSummary(payload.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load today’s household summary."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mealPresentation = summary
    ? mealStatePresentation(summary.meals.currentMember.state, summary.meals.deadline)
    : null;

  return (
    <div className="page-container home-page">
      <header className="home-header">
        <h1>{summary ? `Hey, ${summary.currentUser.name} 👋` : "Home"}</h1>
        <p>{summary ? formatHomeDate(summary.date) : "Today’s household command center."}</p>
      </header>

      {error && (
        <div className="home-error" role="alert">
          <div>
            <strong>Home summary unavailable</strong>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {loading ? <HomeSkeleton /> : summary && mealPresentation && (
        <div className="home-stack">
          <section className="home-meals-card" aria-labelledby="home-meals-title">
            <div className="home-section-heading home-meals-heading">
              <div>
                <span className="home-eyebrow">Today</span>
                <h2 id="home-meals-title">Today’s meals</h2>
                <p>The household needs <strong>{summary.meals.total}</strong> meals prepared.</p>
              </div>
              <div className="home-meal-total" aria-label={`${summary.meals.total} meals total`}>
                <strong>{summary.meals.total}</strong>
                <span>total</span>
              </div>
            </div>

            <div className={`home-meal-state home-tone--${mealPresentation.tone}`}>
              <div>
                <strong>Your count: {summary.meals.currentMember.mealCount ?? "Not set"}</strong>
                <span>{mealPresentation.description}</span>
              </div>
              <span>{mealPresentation.label}</span>
            </div>

            {summary.meals.missingRecordCount > 0 && (
              <p className="home-record-note">
                {summary.meals.missingRecordCount} active {summary.meals.missingRecordCount === 1 ? "member has" : "members have"} no record for today. “Not set” is not counted as zero.
              </p>
            )}

            <div className="home-meal-list">
              {summary.meals.members.map((member) => (
                <div className={member.isCurrentUser ? "is-current" : undefined} key={member.userId}>
                  <Avatar name={member.name} avatarUrl={member.avatarUrl} />
                  <span className="home-meal-member-name">
                    <strong>{member.name}</strong>
                    {member.isCurrentUser && <small>You</small>}
                  </span>
                  <strong className={member.hasRecord ? "home-meal-count" : "home-meal-count is-missing"}>
                    {member.mealCount ?? "Not set"}
                  </strong>
                </div>
              ))}
            </div>

            <Link href="/meals" className="btn btn-primary home-section-action">
              Open Meals
            </Link>
          </section>

          <section aria-labelledby="home-bazar-title">
            <div className="home-section-heading">
              <div>
                <h2 id="home-bazar-title">Bazar</h2>
                <p>Current trip and shared shopping notes.</p>
              </div>
            </div>
            {summary.bazar.activeTrip ? (
              <ActiveTripCard
                trip={summary.bazar.activeTrip}
                isCurrentUserAssigned={summary.bazar.activeTrip.isCurrentUserAssigned}
                onNotesUpdated={(notes) => {
                  setSummary((current) => current?.bazar.activeTrip
                    ? {
                        ...current,
                        bazar: {
                          activeTrip: { ...current.bazar.activeTrip, shoppingNotes: notes },
                        },
                      }
                    : current);
                }}
              />
            ) : (
              <div className="home-empty-card">
                <span className="home-empty-card__icon"><NavIcon name="bazar" size={20} /></span>
                <span>
                  <strong>No active bazar trip</strong>
                  <small>Open Bazar when the household needs another market run.</small>
                </span>
                <Link href="/bazar" className="btn btn-secondary">Open Bazar</Link>
              </div>
            )}
          </section>

          <section aria-labelledby="home-attention-title">
            <div className="home-section-heading">
              <div>
                <h2 id="home-attention-title">Needs attention</h2>
                <p>Your time-sensitive household tasks.</p>
              </div>
            </div>
            {summary.attention.length > 0 ? (
              <div className="home-attention-list">
                {summary.attention.map((item) => {
                  const presentation = attentionPresentation(item);
                  return (
                    <Link
                      href={item.href}
                      className={`home-attention-item home-tone--${presentation.tone}`}
                      key={item.kind}
                    >
                      <span className="home-attention-icon">
                        <NavIcon name={presentation.icon} size={19} />
                      </span>
                      <span>
                        <strong>{presentation.title}</strong>
                        <small>{presentation.description}</small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="home-caught-up">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>You’re all caught up</strong>
                  <small>No household action needs your attention right now.</small>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="home-month-title">
            <div className="home-section-heading">
              <div>
                <h2 id="home-month-title">This month</h2>
                <p>A compact provisional snapshot. Open the source page for details.</p>
              </div>
            </div>
            <div className="home-month-grid">
              <Link href="/money/household" className="home-month-stat">
                <span>My balance</span>
                <strong className={summary.month.direction === "owed" ? "text-positive" : summary.month.direction === "owes" ? "text-negative" : undefined}>
                  {formatTaka(summary.month.provisionalBalance)}
                </strong>
                <small>Provisional · Open Money</small>
              </Link>
              <Link href="/bazar" className="home-month-stat">
                <span>Bazar spending</span>
                <strong>{formatTaka(summary.month.totalBazar)}</strong>
                <small>Household total · Open Bazar</small>
              </Link>
              <Link href="/meals" className="home-month-stat">
                <span>Recorded meals</span>
                <strong>{summary.month.totalMeals}</strong>
                <small>Counted this month · Open Meals</small>
              </Link>
              <Link href="/money/household" className="home-month-stat">
                <span>Meal rate</span>
                <strong>{summary.month.mealRate ? formatTaka(summary.month.mealRate) : "Not available"}</strong>
                <small>Current estimate · Open Money</small>
              </Link>
            </div>
            <Link href="/expenses" className="home-expenses-link">
              Review bulk, maid, and fridge status <span aria-hidden="true">→</span>
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
