import { db } from "@/lib/db";
import {
  hasWebPushConfig,
  sendPushNotification,
} from "@/lib/utils/push";

export async function deliverDebtNotifications(
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;

  const notifications = await db.debtNotification.findMany({
    where: { id: { in: notificationIds } },
    include: {
      user: {
        select: {
          pushSubscriptions: {
            where: { isActive: true },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          },
        },
      },
    },
  });
  const attemptedAt = new Date();

  if (!hasWebPushConfig()) {
    await db.debtNotification.updateMany({
      where: { id: { in: notificationIds } },
      data: { pushStatus: "skipped", pushAttemptedAt: attemptedAt },
    });
    return;
  }

  for (const notification of notifications) {
    const subscriptions = notification.user.pushSubscriptions;
    if (subscriptions.length === 0) {
      await db.debtNotification.update({
        where: { id: notification.id },
        data: { pushStatus: "skipped", pushAttemptedAt: attemptedAt },
      });
      continue;
    }

    let delivered = false;
    for (const subscription of subscriptions) {
      try {
        const result = await sendPushNotification(subscription, {
          title: notification.title,
          body: notification.body,
          url: "/debts",
          tag: `debt-${notification.type}-${notification.entityId}`,
        });
        if (result.invalidSubscription) {
          await db.pushSubscription.update({
            where: { id: subscription.id },
            data: { isActive: false, lastFailedAt: attemptedAt },
          });
        } else {
          delivered = true;
        }
      } catch (error) {
        console.error(
          `Debt notification push failed for notification ${notification.id}.`,
          error
        );
      }
    }

    await db.debtNotification.update({
      where: { id: notification.id },
      data: {
        pushStatus: delivered ? "sent" : "failed",
        pushAttemptedAt: attemptedAt,
      },
    });
  }
}
