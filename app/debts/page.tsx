import { redirect } from "next/navigation";
export const metadata = { title: "Balances & Payments" };

export default function DebtsPage() {
  redirect("/money");
}
