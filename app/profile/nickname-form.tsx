"use client";

import { useState } from "react";
import { updateNickname } from "./actions";

export default function NicknameForm({ initialNickname }: { initialNickname: string | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="text-muted">Nickname</span>
          {success && <span className="badge badge-success">Saved!</span>}
        </div>
        {!isEditing && (
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={() => setIsEditing(true)}
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          >
            Edit
          </button>
        )}
      </div>

      {!isEditing ? (
        <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          {initialNickname || <span className="text-muted italic">No nickname set</span>}
        </div>
      ) : (
        <form 
          action={async (formData) => {
            setIsPending(true);
            setSuccess(false);
            try {
              await updateNickname(formData);
              setIsEditing(false);
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
            } finally {
              setIsPending(false);
            }
          }}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
        >
          <input 
            type="text" 
            name="nickname" 
            defaultValue={initialNickname || ""} 
            placeholder="Enter nickname..."
            className="form-input" 
            style={{ flex: 1, padding: "0.375rem 0.5rem", fontSize: "0.875rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--background)" }}
            disabled={isPending}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
            Save
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={() => setIsEditing(false)}
            disabled={isPending}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
