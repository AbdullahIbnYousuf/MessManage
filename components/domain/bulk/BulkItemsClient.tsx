"use client";

import { useState, useEffect, useCallback } from "react";
import BulkCycleCard from "@/components/domain/bulk/BulkCycleCard";

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
  isAdmin: boolean;
}

export default function BulkItemsClient({ isAdmin }: Props) {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bulk-items");
    const json = await res.json() as { data?: BulkItem[] };
    setItems(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addItem() {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/bulk-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, unit: newUnit }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setAddError(json.error ?? "Failed to add item.");
      } else {
        setNewName("");
        setNewUnit("");
        setShowAddForm(false);
        void load();
      }
    } catch {
      setAddError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Bulk Items</h1>
          <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
            Track gas, rice, and other bulk purchases across their full usage cycle.
          </p>
        </div>
      </div>

      {/* Add item form */}
      {showAddForm && (
        <div className="card fade-in" style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.875rem" }}>New Bulk Item</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            <input className="input" placeholder="Item name (e.g. Gas, Rice)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input" placeholder="Unit (e.g. cylinder, kg) — optional" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
            {addError && <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem" }}>{addError}</div>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary btn-sm" onClick={() => void addItem()} disabled={adding || !newName.trim()}>
                {adding ? <span className="spinner" /> : "Add Item"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📦</div>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>No bulk items yet</div>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginBottom: isAdmin ? "1.5rem" : 0 }}>
            {isAdmin ? "Click below to set up your first bulk item (like Gas or Rice)." : "An admin needs to add the first bulk item (like Gas or Rice)."}
          </p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              + Setup First Item
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {items.map((item) => (
            <BulkCycleCard
              key={item.id}
              item={item}
              onCycleStarted={load}
              onCycleFinished={load}
            />
          ))}
        </div>
      )}

      {/* Hidden add item button at the bottom (Admin Only) */}
      {!loading && items.length > 0 && !showAddForm && isAdmin && (
        <div style={{ marginTop: "3rem", textAlign: "center", opacity: 0.5, transition: "opacity 0.2s" }} className="hover:opacity-100">
          <button 
            onClick={() => setShowAddForm(true)}
            style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Need to track something else? Add custom item
          </button>
        </div>
      )}
    </div>
  );
}
