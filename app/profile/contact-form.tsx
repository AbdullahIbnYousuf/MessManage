"use client";

import { useState, useTransition } from "react";
import { updateContactInfo } from "./actions";

interface ContactFormData {
  phoneNumber: string | null;
  phoneNumber2: string | null;
  bkashNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
}

export default function ContactForm({ initialData }: { initialData: ContactFormData }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateContactInfo(formData);
        setMessage({ type: "success", text: "Contact details updated successfully." });
      } catch (err) {
        console.error(err);
        setMessage({ type: "error", text: "Failed to update details." });
      }
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem" }}>Contact & Banking Details</h3>
        <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
          This information will be visible to other household members.
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            background: message.type === "success" ? "rgba(78, 158, 106, 0.1)" : "var(--color-warning-bg)",
            color: message.type === "success" ? "var(--color-success)" : "var(--color-danger)",
            border: `1px solid ${message.type === "success" ? "rgba(78, 158, 106, 0.2)" : "rgba(192, 80, 80, 0.2)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Personal Contact */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Personal Contact
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="tel" name="phoneNumber" className="form-input" defaultValue={initialData.phoneNumber || ""} placeholder="e.g. 01700000000" />
          </div>
          <div className="form-group">
            <label className="form-label">Secondary Phone</label>
            <input type="tel" name="phoneNumber2" className="form-input" defaultValue={initialData.phoneNumber2 || ""} placeholder="Optional" />
          </div>
        </div>
      </div>

      {/* Banking */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Banking & Payments
        </h4>
        <div className="form-group">
          <label className="form-label">bKash Number</label>
          <input type="tel" name="bkashNumber" className="form-input" defaultValue={initialData.bkashNumber || ""} placeholder="e.g. 01700000000" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label className="form-label">Bank Name</label>
            <input type="text" name="bankName" className="form-input" defaultValue={initialData.bankName || ""} placeholder="e.g. Dutch Bangla Bank" />
          </div>
          <div className="form-group">
            <label className="form-label">Account Number</label>
            <input type="text" name="bankAccountNumber" className="form-input" defaultValue={initialData.bankAccountNumber || ""} placeholder="e.g. 123.456.789" />
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Emergency Contact
        </h4>
        <div className="form-group">
          <label className="form-label">Contact Name</label>
          <input type="text" name="emergencyContactName" className="form-input" defaultValue={initialData.emergencyContactName || ""} placeholder="e.g. Jane Doe" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input type="tel" name="emergencyContactPhone" className="form-input" defaultValue={initialData.emergencyContactPhone || ""} placeholder="e.g. 01700000000" />
          </div>
          <div className="form-group">
            <label className="form-label">Relationship</label>
            <input type="text" name="emergencyContactRelation" className="form-input" defaultValue={initialData.emergencyContactRelation || ""} placeholder="e.g. Sister, Friend" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save Details"}
        </button>
      </div>
    </form>
  );
}
