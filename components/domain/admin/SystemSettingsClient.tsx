"use client";

import { useState, useEffect, useCallback } from "react";

export default function SystemSettingsClient() {
  const [mealDeadline, setMealDeadline] = useState("22:00");
  const [maidChargeDefault, setMaidChargeDefault] = useState("700");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json() as { data?: { mealDeadline: string; maidChargeDefault: string } };
      if (json.data) {
        setMealDeadline(json.data.mealDeadline);
        setMaidChargeDefault(json.data.maidChargeDefault);
      }
    } catch {
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealDeadline, maidChargeDefault }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to save.");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div className="card fade-in" style={{ maxWidth: 500 }}>
      {error && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-danger-glow)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-success-glow)", color: "var(--color-success)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            Daily Meal Deadline (HH:mm)
          </label>
          <input
            type="time"
            required
            className="input"
            value={mealDeadline}
            onChange={(e) => setMealDeadline(e.target.value)}
          />
          <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.375rem" }}>
            Members must request an edit from an admin to change today&apos;s meals after this time. E.g., 11:00 AM.
          </p>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            Default Maid Charge (৳ / month)
          </label>
          <input
            type="number"
            required
            min="0"
            step="1"
            className="input"
            value={maidChargeDefault}
            onChange={(e) => setMaidChargeDefault(e.target.value)}
          />
          <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.375rem" }}>
            The default amount charged to each member when you hit &quot;Apply Maid Charges&quot;.
          </p>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: "0.5rem" }}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
