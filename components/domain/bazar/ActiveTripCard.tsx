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
}

export default function ActiveTripCard({ trip, onNotesUpdated }: Props) {
  const [notes, setNotes] = useState(trip.shoppingNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
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
    try {
      await fetch("/api/bazar/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: currentNotes }),
      });
      initialNotes.current = currentNotes;
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      onNotesUpdated(currentNotes);
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
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid rgba(59,130,246,0.3)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        boxShadow: "0 0 20px var(--color-primary-glow)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <div
          style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "var(--color-success)",
            boxShadow: "0 0 8px var(--color-success)",
            animation: "pulse 2s infinite",
          }}
        />
        <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Bazar Trip Active</span>
        <span className="badge badge-primary" style={{ marginLeft: "auto" }}>Open</span>
      </div>

      {/* Assignees */}
      {assignees.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            Suggested Assignees
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {assignees.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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

      {/* General notes */}
      <div>
        <div className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>General Note</span>
          <div style={{ minWidth: "50px", textAlign: "right" }}>
            {savingNotes ? (
              <span style={{ fontSize: "0.6875rem", color: "var(--color-primary-light)" }}>Saving...</span>
            ) : notesSaved ? (
              <span style={{ fontSize: "0.6875rem", color: "var(--color-success)" }}>Saved</span>
            ) : null}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add general notes or items to buy... (anyone can edit)"
          rows={1}
          style={{
            width: "100%",
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "0.625rem 0.75rem",
            color: "var(--color-text-primary)",
            fontSize: "0.875rem",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            overflow: "hidden",
            minHeight: "44px",
          }}
        />
      </div>
    </div>
  );
}
