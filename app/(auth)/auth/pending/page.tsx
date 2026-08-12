import Link from "next/link";

export const metadata = {
  title: "Awaiting approval",
};

export default function PendingPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="pending-title">
        <div className="auth-state-mark auth-state-mark--warning">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-warning)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 id="pending-title">
          Awaiting approval
        </h1>
        <p>
          Your membership request has been submitted.<br />
          An admin will review it shortly.
        </p>
        <p className="auth-footnote">
          You can close this tab. You&apos;ll be able to sign in once approved.
        </p>

        <div className="auth-hint">
          Already approved?{" "}
          <Link href="/">
            Reload the page
          </Link>
        </div>
      </section>
    </main>
  );
}
