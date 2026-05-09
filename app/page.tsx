import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

// Root route — redirect authenticated users to dashboard,
// unauthenticated users to login
export default async function RootPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/auth/login");
  }
}
