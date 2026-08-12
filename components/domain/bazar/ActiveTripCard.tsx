"use client";

import React, { useState } from "react";

interface Assignee {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Trip {
  id: string;
  status: string;
  triggeredAt: string;
  shoppingNotes: string | null;
  assignee1: Assignee | null;
  assignee2: Assignee | null;
}

interface Props {
  trip: Trip;
  onNotesUpdated: (notes: string) => void;
  isCurrentUserAssigned?: boolean;
}

export default function ActiveTripCard({ trip, onNotesUpdated, isCurrentUserAssigned = false }: Props) {
  const [notes, setNotes] = useState(trip.shoppingNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const initialNotes = React.useRef(trip.shoppingNotes ?? "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [notes]);

  const saveNotes = React.useCallback(async (currentNotes: string) => {
    if (currentNotes === initialNotes.current) return;
    setSavingNotes(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/bazar/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: currentNotes }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not save the shopping notes.");
      }
      initialNotes.current = currentNotes;
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      onNotesUpdated(currentNotes);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the shopping notes.");
    } finally {
      setSavingNotes(false);
    }
  }, [onNotesUpdated]);

  React.useEffect(() => {
    if (notes === initialNotes.current) return;
    const timer = setTimeout(() => {
      void saveNotes(notes);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notes, saveNotes]);

  React.useEffect(() => {
    const handleBlur = () => {
      void saveNotes(notes);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [notes, saveNotes]);

  const assignees = [trip.assignee1, trip.assignee2].filter(Boolean) as Assignee[];

  return (
    <section className="bazar-active-card" aria-labelledby={`bazar-trip-${trip.id}`}>
      <div className="bazar-active-card__header">
        <span className="bazar-active-card__status" aria-hidden="true" />
        <div>
          <span>Current trip</span>
          <h2 id={`bazar-trip-${trip.id}`}>Bazar trip is active</h2>
        </div>
        <span className="badge badge-primary bazar-active-card__badge">
          {isCurrentUserAssigned ? "You’re assigned" : "Open"}
        </span>
      </div>

      {assignees.length > 0 && (
        <div className="bazar-assignees">
          <span>Suggested assignees</span>
          <div>
            {assignees.map((a) => (
              <div className="bazar-assignee" key={a.id}>
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt={a.name} className="avatar avatar-sm" />
                ) : (
                  <div className="avatar-fallback" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>
                    {a.name.charAt(0)}
                  </div>
                )}
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bazar-notes">
        <div className="bazar-notes__label">
          <label htmlFor={`bazar-notes-${trip.id}`}>Shared shopping notes</label>
          <div aria-live="polite">
            {savingNotes ? (
              <span>Saving…</span>
            ) : notesSaved ? (
              <span className="text-positive">Saved</span>
            ) : null}
          </div>
        </div>
        <textarea
          id={`bazar-notes-${trip.id}`}
          ref={textareaRef}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaveError(null);
          }}
          placeholder="Add general notes or items to buy... (anyone can edit)"
          rows={1}
          className="input bazar-notes__input"
        />
        {saveError && (
          <div className="bazar-notes__error" role="alert">
            <span>{saveError}</span>
            <button type="button" className="btn btn-secondary" onClick={() => void saveNotes(notes)}>
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
