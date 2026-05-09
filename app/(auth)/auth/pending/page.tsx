import Link from "next/link";

export const metadata = {
  title: "Awaiting Approval — MealSync",
};

export default function PendingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg-base)",
        padding: "1.5rem",
      }}
    >
      <div
        className="glass"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "2.5rem",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--color-warning-glow)",
            border: "1px solid rgba(245,158,11,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-warning)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Awaiting Approval
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.65, marginBottom: "1.5rem" }}>
          Your membership request has been submitted.<br />
          An admin will review it shortly.
        </p>
        <p className="text-muted" style={{ fontSize: "0.8rem" }}>
          You can close this tab. You&apos;ll be able to sign in once approved.
        </p>

        {/* Reload hint */}
        <div
          style={{
            marginTop: "2rem",
            padding: "0.75rem 1rem",
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.8125rem",
            color: "var(--color-text-muted)",
          }}
        >
          Already approved?{" "}
          <Link href="/" style={{ color: "var(--color-primary-light)", textDecoration: "none", fontWeight: 500 }}>
            Reload the page
          </Link>
        </div>
      </div>
    </div>
  );
}
