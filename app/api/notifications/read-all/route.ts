import { debtErrorResponse, requireDebtUser } from "@/lib/utils/debts-api";
import { markAllDebtNotificationsRead } from "@/lib/services/debts/notification-inbox";

export async function POST() {
  try {
    const user = await requireDebtUser();
    return Response.json({
      data: await markAllDebtNotificationsRead(user.id),
    });
  } catch (error) {
    return debtErrorResponse(error, "Mark all notifications read");
  }
}
