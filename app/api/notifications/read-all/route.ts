import { debtErrorResponse, requireDebtUser } from "@/lib/utils/debts-api";
import { markAllDebtNotificationsRead } from "@/lib/services/debts/notification-inbox";
import { requirePersonalAccount } from "@/lib/services/acting-identity";

export async function POST() {
  try {
    const user = await requireDebtUser();
    await requirePersonalAccount();
    return Response.json({
      data: await markAllDebtNotificationsRead(user.id),
    });
  } catch (error) {
    return debtErrorResponse(error, "Mark all notifications read");
  }
}
