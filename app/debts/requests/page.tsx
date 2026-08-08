import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function DebtRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED !== "true") redirect("/dashboard");
  redirect("/money");
}
