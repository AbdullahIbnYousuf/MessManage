import { debtErrorResponse, requireDebtUser } from "@/lib/utils/debts-api";
import { markDebtNotificationRead } from "@/lib/services/debts/notification-inbox";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDebtUser();
    const { id } = await params;
    return Response.json({
      data: await markDebtNotificationRead(user.id, id),
    });
  } catch (error) {
    return debtErrorResponse(error, "Mark notification read");
  }
}
