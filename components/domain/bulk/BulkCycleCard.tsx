"use client";

import { useState } from "react";

interface Cycle {
  id: string;
  cost: string;
  purchaseDate: string;
  startedAt: string;
  purchasedBy: { id: string; name: string; avatarUrl: string | null };
}

interface FinishedCycle {
  id: string;
  cost: string;
  purchaseDate: string;
  startedAt: string;
  finishedAt: string;
  purchasedBy: { name: string };
  finishedBy: { name: string } | null;
}

interface BulkItem {
  id: string;
  name: string;
  unit: string | null;
  activeCycle: Cycle | null;
  finishedCycles: FinishedCycle[];
}

interface Props {
  item: BulkItem;
  isAdmin: boolean;
  currentUserId: string;
  onCycleStarted: () => void;
  onCycleFinished: () => void;
  todayStr: string;
}

export default function BulkCycleCard({ item, isAdmin, currentUserId, onCycleStarted, onCycleFinished, todayStr }: Props) {
  const [showNewCycleForm, setShowNewCycleForm] = useState(false);
  const [cost, setCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  // Edit active cycle state
  const [editingCycle, setEditingCycle] = useState(false);
  const [editCost, setEditCost] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [nowMs] = useState(() => new Date(todayStr + "T00:00:00").getTime());

  // Can the current user edit this active cycle?
  const purchaseDateStr = item.activeCycle?.purchaseDate.slice(0, 10);
  const canEdit = item.activeCycle && (
    isAdmin ||
    (
      item.activeCycle.purchasedBy.id === currentUserId &&
      purchaseDateStr === todayStr
    )
  );

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

  function openEditCycle() {
    if (!item.activeCycle) return;
    setEditCost(item.activeCycle.cost);
    setEditPurchaseDate(item.activeCycle.purchaseDate);
    setEditError(null);
    setEditingCycle(true);
  }

  async function saveEditCycle() {
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/bulk-items/${item.id}/cycle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost: parseFloat(editCost),
          purchaseDate: editPurchaseDate,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setEditError(json.error ?? "Failed to update.");
      } else {
        setEditingCycle(false);
        onCycleStarted(); // reload
      }
    } catch {
      setEditError("Network error.");
    } finally {
      setEditLoading(false);
    }
  }

  const purchaseMidnight = purchaseDateStr
    ? new Date(purchaseDateStr + "T00:00:00").getTime()
    : 0;
  const daysActive = item.activeCycle
    ? Math.max(0, Math.round((nowMs - purchaseMidnight) / 86400000))
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
      {item.activeCycle && !editingCycle && (
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

      {/* Inline edit form for active cycle */}
      {item.activeCycle && editingCycle && (
        <div
          className="fade-in"
          style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-md)",
            padding: "0.875rem",
            marginBottom: "0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Edit Cost</div>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Total cost (৳)"
            value={editCost}
            onChange={(e) => setEditCost(e.target.value)}
          />
          <input
            className="input"
            type="date"
            value={editPurchaseDate}
            onChange={(e) => setEditPurchaseDate(e.target.value)}
          />
          {editError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{editError}</div>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-sm btn-primary" onClick={() => void saveEditCycle()} disabled={editLoading || !editCost}>
              {editLoading ? <span className="spinner" /> : "Save"}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditingCycle(false)}>Cancel</button>
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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {canEdit && !editingCycle && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={openEditCycle}
              style={{ fontSize: "0.8125rem" }}
            >
              ✏️ Edit Cost
            </button>
          )}
          {isAdmin && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => void finishCycle()}
              disabled={finishing}
              style={{ borderColor: "rgba(239,68,68,0.4)", color: "var(--color-danger)" }}
            >
              {finishing ? <span className="spinner" /> : "Mark as Finished"}
            </button>
          )}
        </div>
      ) : showNewCycleForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {/* Warning */}
          <div style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.625rem 0.75rem",
            fontSize: "0.8125rem",
            color: "var(--color-warning)",
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-start",
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>Check the cost carefully. You can only edit the cost <strong>today</strong>. Once this cycle is marked as finished, the cost is locked and splits are calculated permanently.</span>
          </div>
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
          {error && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{error}</div>}
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

      {/* Past cycles */}
      {item.finishedCycles.length > 0 && (
        <div style={{ marginTop: "0.875rem", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "0.75rem" }}>
          <button
            onClick={() => setPastExpanded((v) => !v)}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Past Cycles</span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              {item.finishedCycles.length}
              <span style={{ transition: "transform 0.2s", display: "inline-block", transform: pastExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </span>
          </button>
          {pastExpanded && (
            <div style={{ marginTop: "0.625rem", display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "240px", overflowY: "auto", paddingRight: "0.25rem" }} className="fade-in">
              {item.finishedCycles.map((c) => {
                const start = new Date(c.startedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                const end = new Date(c.finishedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                const days = Math.round((new Date(c.finishedAt).getTime() - new Date(c.startedAt).getTime()) / 86400000);
                return (
                  <div key={c.id} style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)", padding: "0.625rem 0.75rem", fontSize: "0.8125rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>৳{parseFloat(c.cost).toLocaleString()}</span>
                      <span className="text-muted">{days}d</span>
                    </div>
                    <div className="text-muted">{start} → {end}</div>
                    <div className="text-muted" style={{ marginTop: "0.125rem" }}>
                      Bought by {c.purchasedBy.name}
                      {c.finishedBy && <> · Closed by {c.finishedBy.name}</>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
