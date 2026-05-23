import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MealSync — Household Meal & Expense Manager",
  description:
    "Shared meal tracking, bazar management, and expense settlement for household groups",
  icons: {
    icon: "/logo.png",
  },
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <html lang="en" className={inter.variable}>
      <body>
        {user ? (
          // Authenticated layout — sidebar + main content
          <div className="layout-wrapper">
            <Sidebar user={user} />
            <main className="layout-main">
              {children}
            </main>
          </div>
        ) : (
          // Unauthenticated layout — full page (login, pending, rejected screens)
          <div className="layout-wrapper" style={{ display: "block" }}>
            {children}
          </div>
        )}
      </body>
    </html>
  );
}
