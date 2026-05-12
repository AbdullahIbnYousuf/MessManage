import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import MonthlyReportClient from "@/components/domain/settlement/MonthlyReportClient";

export const metadata = {
  title: "Settlement Report — MealSync",
  description: "Detailed monthly settlement report.",
};

export default async function MonthlyReportPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  return <MonthlyReportClient params={params} />;
}
