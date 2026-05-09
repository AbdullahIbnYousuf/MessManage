import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import Link from "next/link";

export const metadata = {
  title: "Admin Panel — MealSync",
};

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="page-container">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          Admin Panel
        </h1>
        <p className="text-secondary">Manage members, settings, and system operations.</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Membership Requests */}
        <Link href="/admin/membership" style={{ textDecoration: "none" }}>
          <div
            className="card"
            style={{
              cursor: "pointer",
              transition: "all 0.15s",
              borderColor: "var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "var(--color-primary-glow)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--color-primary-light)" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Membership Requests</div>
                <div className="text-muted" style={{ fontSize: "0.8125rem" }}>Review pending sign-up requests</div>
              </div>
            </div>
          </div>
        </Link>

        {/* Members List */}
        <Link href="/admin/members" style={{ textDecoration: "none" }}>
          <div className="card" style={{ cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "var(--color-success-glow)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--color-success)" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>All Members</div>
                <div className="text-muted" style={{ fontSize: "0.8125rem" }}>View and manage member accounts</div>
              </div>
            </div>
          </div>
        </Link>

        {/* Meal Edit Requests */}
        <Link href="/admin/meal-edit-requests" style={{ textDecoration: "none" }}>
          <div className="card" style={{ cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "var(--color-warning-glow)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--color-warning)" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Meal Edit Requests</div>
                <div className="text-muted" style={{ fontSize: "0.8125rem" }}>Approve post-deadline meal changes</div>
              </div>
            </div>
          </div>
        </Link>

        {/* System Settings */}
        <Link href="/admin/settings" style={{ textDecoration: "none" }}>
          <div className="card" style={{ cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>System Settings</div>
                <div className="text-muted" style={{ fontSize: "0.8125rem" }}>Configure meal deadline and defaults</div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
