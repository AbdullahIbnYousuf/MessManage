import { signOut } from "@/lib/auth";

export const metadata = {
  title: "Account deactivated",
};

export default function DeactivatedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="deactivated-title">
        <div className="auth-state-mark">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-muted)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>

        <h1 id="deactivated-title">
          Account deactivated
        </h1>
        <p>
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
      </section>
    </main>
  );
}
