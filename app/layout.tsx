import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MessManage",
    template: "%s — MessManage",
  },
  description:
    "Meals, expenses, and balances for your household.",
  applicationName: "MessManage",
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
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable}`}>
      <body>
        {user ? (
          <div className="layout-wrapper">
            <Sidebar user={user} />
            <main className="layout-main">
              {children}
            </main>
          </div>
        ) : (
          <div className="layout-wrapper" style={{ display: "block" }}>
            {children}
          </div>
        )}
      </body>
    </html>
  );
}
