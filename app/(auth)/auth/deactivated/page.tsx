import { signOut } from "@/lib/auth";

export const metadata = {
  title: "Account Deactivated — MealSync",
};

export default function DeactivatedPage() {
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
            background: "rgba(71,85,105,0.2)",
            border: "1px solid rgba(71,85,105,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-muted)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>

        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Account Deactivated
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.65, marginBottom: "1.75rem" }}>
          Your account has been deactivated. This usually happens after all balances are settled and you have left the household.
          Please contact an admin if you think this is wrong.
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/auth/login" });
          }}
        >
          <button type="submit" className="btn btn-secondary" style={{ width: "100%" }}>
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
