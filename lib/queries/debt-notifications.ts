import { db } from "@/lib/db";
import { paginateNotifications } from "@/lib/domain/debts/notifications";
import type {
  DebtNotificationItem,
  DebtNotificationPage,
} from "@/types/debts";

function serializeNotification(notification: {
  id: string;
  type: DebtNotificationItem["type"];
  entityType: DebtNotificationItem["entityType"];
  entityId: string;
  title: string;
  body: string;
  readAt: Date | null;
  pushStatus: DebtNotificationItem["pushStatus"];
  pushAttemptedAt: Date | null;
  createdAt: Date;
}): DebtNotificationItem {
  return {
    id: notification.id,
    type: notification.type,
    entityType: notification.entityType,
    entityId: notification.entityId,
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt?.toISOString() ?? null,
    pushStatus: notification.pushStatus,
    pushAttemptedAt: notification.pushAttemptedAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function fetchDebtNotificationInbox(options: {
  userId: string;
  unreadOnly: boolean;
  cursor?: string;
  limit: number;
}): Promise<DebtNotificationPage> {
  const [notifications, unreadCount] = await Promise.all([
    db.debtNotification.findMany({
      where: {
        userId: options.userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
    }),
    db.debtNotification.count({
      where: { userId: options.userId, readAt: null },
    }),
  ]);

  return paginateNotifications(
    notifications.map(serializeNotification),
    unreadCount,
    options.limit,
    options.cursor
  );
}
