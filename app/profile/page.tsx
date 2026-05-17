import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import NicknameForm from "./nickname-form";
import ContactForm from "./contact-form";

export const metadata = {
  title: "Profile — MealSync",
};

export default async function ProfilePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/login");

  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { 
      nickname: true,
      phoneNumber: true,
      phoneNumber2: true,
      bkashNumber: true,
      bankName: true,
      bankAccountNumber: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
    },
  });

  const user = { ...sessionUser, nickname: dbUser?.nickname ?? null };

  const contactData = {
    phoneNumber: dbUser?.phoneNumber ?? null,
    phoneNumber2: dbUser?.phoneNumber2 ?? null,
    bkashNumber: dbUser?.bkashNumber ?? null,
    bankName: dbUser?.bankName ?? null,
    bankAccountNumber: dbUser?.bankAccountNumber ?? null,
    emergencyContactName: dbUser?.emergencyContactName ?? null,
    emergencyContactPhone: dbUser?.emergencyContactPhone ?? null,
    emergencyContactRelation: dbUser?.emergencyContactRelation ?? null,
  };

  return (
    <div className="page-container">
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Profile</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 600 }}>
        {/* User card */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="avatar avatar-xl" />
            ) : (
              <div className="avatar-fallback avatar-xl" style={{ fontSize: "1.5rem" }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.125rem" }}>{user.name}</div>
              <div className="text-secondary" style={{ fontSize: "0.875rem" }}>{user.email}</div>
              <div style={{ marginTop: "0.375rem", display: "flex", gap: "0.5rem" }}>
                <span className={user.role === "admin" ? "badge badge-primary" : "badge badge-muted"}>
                  {user.role}
                </span>
                <span className={user.status === "active" ? "badge badge-success" : "badge badge-danger"}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
              <span className="text-muted">Member ID</span>
              <span className="text-secondary" style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>
                {user.id.slice(0, 8)}…
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
              <span className="text-muted">Google OAuth</span>
              <span className="badge badge-success">Connected</span>
            </div>
            
            <NicknameForm initialNickname={user.nickname} />
          </div>
        </div>

        <ContactForm initialData={contactData} />

        {/* Sign out */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Sign Out</div>
          <p className="text-secondary" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
            You will be redirected to the login page.
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/auth/login" });
            }}
          >
            <button type="submit" className="btn btn-secondary btn-sm">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
