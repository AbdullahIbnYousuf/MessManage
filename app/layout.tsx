import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MealSync — Household Meal & Expense Manager",
  description:
    "Shared meal tracking, bazar management, and expense settlement for household groups",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
