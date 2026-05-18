"use client";

import { useState, useEffect, useCallback } from "react";

export default function SystemSettingsClient() {
  const [mealDeadline, setMealDeadline] = useState("22:00");
  const [maidChargeDefault, setMaidChargeDefault] = useState("700");
  const [electricityUnitPrice, setElectricityUnitPrice] = useState("8");
  const [loading, setLoading] = useState(true);

  // Status for Meal Deadline Form
  const [savingMeal, setSavingMeal] = useState(false);
  const [errorMeal, setErrorMeal] = useState<string | null>(null);
  const [successMeal, setSuccessMeal] = useState(false);

  // Status for Maid Charge Form
  const [savingMaid, setSavingMaid] = useState(false);
  const [errorMaid, setErrorMaid] = useState<string | null>(null);
  const [successMaid, setSuccessMaid] = useState(false);

  // Status for Electricity Unit Price Form
  const [savingElec, setSavingElec] = useState(false);
  const [errorElec, setErrorElec] = useState<string | null>(null);
  const [successElec, setSuccessElec] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json() as { data?: { mealDeadline: string; maidChargeDefault: string; electricityUnitPrice: string } };
      if (json.data) {
        setMealDeadline(json.data.mealDeadline);
        setMaidChargeDefault(json.data.maidChargeDefault);
        setElectricityUnitPrice(json.data.electricityUnitPrice);
      }
    } catch {
      setErrorMeal("Failed to load settings.");
      setErrorMaid("Failed to load settings.");
      setErrorElec("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSaveMeal(e: React.FormEvent) {
    e.preventDefault();
    setSavingMeal(true);
    setErrorMeal(null);
    setSuccessMeal(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealDeadline }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setErrorMeal(json.error ?? "Failed to save.");
      } else {
        setSuccessMeal(true);
        setTimeout(() => setSuccessMeal(false), 3000);
      }
    } catch {
      setErrorMeal("Network error.");
    } finally {
      setSavingMeal(false);
    }
  }

  async function handleSaveMaid(e: React.FormEvent) {
    e.preventDefault();
    setSavingMaid(true);
    setErrorMaid(null);
    setSuccessMaid(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maidChargeDefault }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setErrorMaid(json.error ?? "Failed to save.");
      } else {
        setSuccessMaid(true);
        setTimeout(() => setSuccessMaid(false), 3000);
      }
    } catch {
      setErrorMaid("Network error.");
    } finally {
      setSavingMaid(false);
    }
  }

  async function handleSaveElec(e: React.FormEvent) {
    e.preventDefault();
    setSavingElec(true);
    setErrorElec(null);
    setSuccessElec(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electricityUnitPrice }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setErrorElec(json.error ?? "Failed to save.");
      } else {
        setSuccessElec(true);
        setTimeout(() => setSuccessElec(false), 3000);
      }
    } catch {
      setErrorElec("Network error.");
    } finally {
      setSavingElec(false);
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 500 }}>
      {/* Meal Deadline Card */}
      <div className="card fade-in">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Meal Deadline</h2>
        {errorMeal && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-danger-glow)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
            {errorMeal}
          </div>
        )}
        {successMeal && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-success-glow)", color: "var(--color-success)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
            Meal deadline saved successfully!
          </div>
        )}

        <form onSubmit={(e) => void handleSaveMeal(e)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
          <button type="submit" className="btn btn-primary" disabled={savingMeal} style={{ alignSelf: "flex-start" }}>
            {savingMeal ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Save Deadline"}
          </button>
        </form>
      </div>

      {/* Maid Charge Card */}
      <div className="card fade-in">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Default Maid Charge</h2>
        {errorMaid && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-danger-glow)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
            {errorMaid}
          </div>
        )}
        {successMaid && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-success-glow)", color: "var(--color-success)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
            Maid charge saved successfully!
          </div>
        )}

        <form onSubmit={(e) => void handleSaveMaid(e)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
              Amount (৳ / month)
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
          <button type="submit" className="btn btn-primary" disabled={savingMaid} style={{ alignSelf: "flex-start" }}>
            {savingMaid ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Save Maid Charge"}
          </button>
        </form>
      </div>
      {/* Electricity Unit Price Card */}
      <div className="card fade-in">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Electricity Unit Price</h2>
        {errorElec && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-danger-glow)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
            {errorElec}
          </div>
        )}
        {successElec && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-success-glow)", color: "var(--color-success)", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>
            Electricity unit price saved successfully!
          </div>
        )}
        <form onSubmit={(e) => void handleSaveElec(e)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
              Price per Unit (৳ / kWh)
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              className="input"
              value={electricityUnitPrice}
              onChange={(e) => setElectricityUnitPrice(e.target.value)}
            />
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.375rem" }}>
              Default rate used when posting fridge electricity bills. Can be overridden per bill.
            </p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingElec} style={{ alignSelf: "flex-start" }}>
            {savingElec ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Save Unit Price"}
          </button>
        </form>
      </div>
    </div>
  );
}
