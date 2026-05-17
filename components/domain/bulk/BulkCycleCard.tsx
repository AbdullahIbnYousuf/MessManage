"use client";

import { useState } from "react";

interface Cycle {
  id: string;
  cost: string;
  purchaseDate: string;
  startedAt: string;
  purchasedBy: { id: string; name: string; avatarUrl: string | null };
}

interface BulkItem {
  id: string;
  name: string;
  unit: string | null;
  activeCycle: Cycle | null;
}

interface Props {
  item: BulkItem;
  isAdmin: boolean;
  onCycleStarted: () => void;
  onCycleFinished: () => void;
}

export default function BulkCycleCard({ item, isAdmin, onCycleStarted, onCycleFinished }: Props) {
  const [showNewCycleForm, setShowNewCycleForm] = useState(false);
  const [cost, setCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Compute daysActive once on mount (stable — doesn't need to re-render every second)
  const [nowMs] = useState(() => Date.now());

  async function startCycle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bulk-items/${item.id}/cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost: parseFloat(cost), purchaseDate }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to start cycle.");
      } else {
        setShowNewCycleForm(false);
        setCost("");
        onCycleStarted();
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function finishCycle() {
    if (!confirm(`Mark the ${item.name} cycle as finished? This will calculate and post allocations for all members immediately.`)) return;
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/bulk-items/${item.id}/cycle/finish`, { method: "POST" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to finish cycle.");
      } else {
        onCycleFinished();
      }
    } catch {
      setError("Network error.");
    } finally {
      setFinishing(false);
    }
  }

  const daysActive = item.activeCycle
    ? Math.floor((nowMs - new Date(item.activeCycle.startedAt).getTime()) / 86400000)
    : null;

  return (
    <div className="card">
      {/* Item header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>{item.name}</div>
          {item.unit && <div className="text-muted" style={{ fontSize: "0.8125rem" }}>{item.unit}</div>}
        </div>
        {item.activeCycle ? (
          <span className="badge badge-success">Active</span>
        ) : (
          <span className="badge badge-muted">No active cycle</span>
        )}
      </div>

      {/* Active cycle info */}
      {item.activeCycle && (
        <div
          style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem",
            marginBottom: "0.875rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.5rem",
          }}
        >
          <div>
            <div className="stat-label">Cost</div>
            <div style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
              ৳{parseFloat(item.activeCycle.cost).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="stat-label">Days Active</div>
            <div style={{ fontWeight: 700, color: "var(--color-warning)" }}>{daysActive}d</div>
          </div>
          <div>
            <div className="stat-label">Bought By</div>
            <div style={{ fontWeight: 500, fontSize: "0.8125rem" }}>{item.activeCycle.purchasedBy.name}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}

      {/* Actions */}
      {item.activeCycle ? (
        isAdmin && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => void finishCycle()}
            disabled={finishing}
            style={{ borderColor: "rgba(239,68,68,0.4)", color: "var(--color-danger)" }}
          >
            {finishing ? <span className="spinner" /> : "Mark as Finished"}
          </button>
        )
      ) : showNewCycleForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Total cost (৳)"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <input
            className="input"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-sm btn-primary" onClick={() => void startCycle()} disabled={loading || !cost}>
              {loading ? <span className="spinner" /> : "Record Purchase"}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowNewCycleForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm btn-primary" onClick={() => setShowNewCycleForm(true)}>
          + Record Purchase
        </button>
      )}
    </div>
  );
}
