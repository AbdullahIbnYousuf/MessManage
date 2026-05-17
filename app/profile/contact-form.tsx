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

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  icon,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
  placeholder?: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={name}
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {icon}
        </span>
        <input
          id={name}
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          style={{
            width: "100%",
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "0.625rem 0.875rem 0.625rem 2.375rem",
            fontSize: "0.9rem",
            color: "var(--color-text-primary)",
            outline: "none",
            transition: "border-color 0.18s, box-shadow 0.18s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(212, 114, 74, 0.18)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid var(--color-border)",
        marginBottom: "0.875rem",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "var(--color-primary-subtle)",
          border: "1px solid rgba(212, 114, 74, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-primary-light)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: "0.9375rem", fontWeight: 700 }}>{title}</span>
    </div>
  );
}

export default function ContactForm({ initialData }: { initialData: ContactFormData }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateContactInfo(formData);
        setMessage({ type: "success", text: "Contact details saved successfully." });
        setTimeout(() => setMessage(null), 4000);
      } catch (err) {
        console.error(err);
        setMessage({ type: "error", text: "Failed to save. Please try again." });
      }
    });
  }

  return (
    <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Personal Contact Section ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <SectionHeading
          title="Personal Contact"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <Field
          label="Primary Phone"
          name="phoneNumber"
          type="tel"
          defaultValue={initialData.phoneNumber || ""}
          placeholder="01700-000000"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <Field
          label="Secondary Phone"
          name="phoneNumber2"
          type="tel"
          defaultValue={initialData.phoneNumber2 || ""}
          placeholder="Optional"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
      </div>

      {/* ── Banking & Payments Section ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <SectionHeading
          title="Banking & Payments"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }
        />
        <Field
          label="bKash Number"
          name="bkashNumber"
          type="tel"
          defaultValue={initialData.bkashNumber || ""}
          placeholder="01700-000000"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <Field
          label="Bank Name"
          name="bankName"
          defaultValue={initialData.bankName || ""}
          placeholder="e.g. Dutch Bangla Bank"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          }
        />
        <Field
          label="Account Number"
          name="bankAccountNumber"
          defaultValue={initialData.bankAccountNumber || ""}
          placeholder="e.g. 1234567890"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          }
        />
      </div>

      {/* ── Emergency Contact Section ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <SectionHeading
          title="Emergency Contact"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <Field
          label="Contact Name"
          name="emergencyContactName"
          defaultValue={initialData.emergencyContactName || ""}
          placeholder="e.g. Jane Doe"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <Field
          label="Contact Phone"
          name="emergencyContactPhone"
          type="tel"
          defaultValue={initialData.emergencyContactPhone || ""}
          placeholder="01700-000000"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <Field
          label="Relationship"
          name="emergencyContactRelation"
          defaultValue={initialData.emergencyContactRelation || ""}
          placeholder="e.g. Sister, Friend"
          icon={
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Save button + feedback ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {message && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: message.type === "success" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
              color: message.type === "success" ? "var(--color-success)" : "var(--color-danger)",
              border: `1px solid ${message.type === "success" ? "rgba(78, 158, 106, 0.25)" : "rgba(192, 80, 80, 0.25)"}`,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {message.type === "success" ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97L13.75 4a2 2 0 00-3.5 0L3.25 16.03A2 2 0 005.07 19z" />
              </svg>
            )}
            {message.text}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
          style={{ width: "100%", padding: "0.75rem", fontSize: "0.9375rem" }}
        >
          {isPending ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Saving…
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Save Details
            </>
          )}
        </button>
      </div>
    </form>
  );
}
