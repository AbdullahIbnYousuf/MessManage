import { signIn } from "@/lib/auth";

export const metadata = {
  title: "Sign In — MealSync",
};

export default function LoginPage() {
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
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="glass"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "2.5rem",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "14px",
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            boxShadow: "0 0 24px var(--color-primary-glow)",
          }}
        >
          <svg width="26" height="26" fill="white" viewBox="0 0 24 24">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.42 1.28 4.59 3.34 6.06L4 21l4.35-2.17C9.39 19.27 10.66 19.5 12 19.5c5.52 0 10-3.58 10-8.5S17.52 3 12 3z" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: "1.625rem",
            fontWeight: 800,
            marginBottom: "0.375rem",
            letterSpacing: "-0.02em",
          }}
        >
          <span className="gradient-text">MealSync</span>
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.875rem", marginBottom: "2rem" }}>
          Household meal &amp; expense management
        </p>

        {/* Sign in form */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              background: "white",
              color: "#1f2937",
              fontWeight: 600,
              fontSize: "0.9375rem",
              padding: "0.75rem 1.25rem",
              borderRadius: "var(--radius-md)",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {/* Google logo */}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "1.5rem", lineHeight: 1.5 }}>
          New members require admin approval.<br />Your request is submitted automatically.
        </p>
      </div>
    </div>
  );
}
