import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  formatMealReminderBody,
  formatMealReminderTitle,
  getDueMealReminders,
} from "@/lib/domain/notifications";
import { getNow, parseDateString } from "@/lib/utils/dates";
import { hasWebPushConfig, sendPushNotification } from "@/lib/utils/push";

export const runtime = "nodejs";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    if (!hasWebPushConfig()) {
      return Response.json(
        { error: "Push notifications are not configured." },
        { status: 503 }
      );
    }

    const config = await db.systemConfig.findFirst({
      select: { mealDeadline: true },
    });
    const deadline = config?.mealDeadline ?? "22:00";
    const dueReminders = getDueMealReminders(getNow(), deadline);

    if (dueReminders.length === 0) {
      return Response.json({ ok: true, sent: 0, skipped: 0 });
    }

    const users = await db.user.findMany({
      where: { status: "active" },
      select: {
        id: true,
        pushSubscriptions: {
          where: { isActive: true },
          select: { id: true, endpoint: true, p256dh: true, auth: true },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const reminder of dueReminders) {
      const reminderDate = parseDateString(reminder.mealDate);

      for (const user of users) {
        if (user.pushSubscriptions.length === 0) {
          skipped++;
          continue;
        }

        const existingDelivery = await db.notificationDelivery.findFirst({
          where: {
            userId: user.id,
            reminderDate,
            type: reminder.type,
          },
          select: { id: true },
        });

        if (existingDelivery) {
          skipped++;
          continue;
        }

        let deliveredToSubscription: string | null = null;
        for (const subscription of user.pushSubscriptions) {
          try {
            const result = await sendPushNotification(subscription, {
              title: formatMealReminderTitle(reminder.type),
              body: formatMealReminderBody(reminder.type, deadline),
              url: "/meals",
              tag: `meal-${reminder.type}-${reminder.mealDate}`,
            });

            if (result.invalidSubscription) {
              await db.pushSubscription.update({
                where: { id: subscription.id },
                data: { isActive: false, lastFailedAt: new Date() },
              });
              continue;
            }

            deliveredToSubscription ??= subscription.id;
            sent++;
          } catch (error) {
            failed++;
            console.error("Meal reminder push failed:", error);
          }
        }

        if (deliveredToSubscription) {
          try {
            await db.notificationDelivery.create({
              data: {
                userId: user.id,
                subscriptionId: deliveredToSubscription,
                reminderDate,
                type: reminder.type,
                sentAt: new Date(),
              },
            });
          } catch (error) {
            if (!isUniqueConstraintError(error)) throw error;
          }
        }
      }
    }

    return Response.json({ ok: true, sent, skipped, failed });
  } catch (error) {
    console.error("Meal reminder cron error:", error);
    return Response.json({ error: "Cron job failed." }, { status: 500 });
  }
}
