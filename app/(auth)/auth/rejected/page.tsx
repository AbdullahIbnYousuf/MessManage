import { signIn } from "@/lib/auth";

export const metadata = {
  title: "Request Rejected — MealSync",
};

export default function RejectedPage() {
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
        style={{ width: "100%", maxWidth: 440, padding: "2.5rem", textAlign: "center" }}
      >
        <div
          style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "var(--color-danger-glow)",
            border: "1px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-danger)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Request Not Approved
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.65, marginBottom: "1.75rem" }}>
          Your membership request was not approved by the admin.
          Please contact a household member directly if you believe this is a mistake.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ width: "100%" }}
          >
            Try signing in again
          </button>
        </form>
      </div>
    </div>
  );
}
