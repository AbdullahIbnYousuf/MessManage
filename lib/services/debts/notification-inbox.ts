import { db } from "@/lib/db";
import { DebtError } from "@/lib/domain/debts/errors";
import { validateUuid } from "@/lib/domain/debts/validation";

function notificationId(value: unknown): string {
  try {
    return validateUuid(value, "notificationId");
  } catch {
    throw new DebtError(
      "VALIDATION_ERROR",
      "notificationId must be a valid UUID."
    );
  }
}

export async function markDebtNotificationRead(
  userId: string,
  idInput: unknown
): Promise<{ id: string; readAt: string }> {
  const id = notificationId(idInput);
  const notification = await db.debtNotification.findFirst({
    where: { id, userId },
    select: { id: true, readAt: true },
  });
  if (!notification) {
    throw new DebtError("VALIDATION_ERROR", "Notification not found.");
  }

  const readAt = notification.readAt ?? new Date();
  if (!notification.readAt) {
    await db.debtNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt },
    });
  }
  const current = await db.debtNotification.findFirst({
    where: { id, userId },
    select: { readAt: true },
  });
  return { id, readAt: (current?.readAt ?? readAt).toISOString() };
}

export async function markAllDebtNotificationsRead(
  userId: string
): Promise<{ updatedCount: number; readAt: string }> {
  const readAt = new Date();
  const result = await db.debtNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt },
  });
  return { updatedCount: result.count, readAt: readAt.toISOString() };
}
