import { signIn } from "@/lib/auth";

export const metadata = {
  title: "Request rejected",
};

export default function RejectedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="rejected-title">
        <div className="auth-state-mark auth-state-mark--danger">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-danger)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 id="rejected-title">
          Request not approved
        </h1>
        <p>
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
      </section>
    </main>
  );
}
