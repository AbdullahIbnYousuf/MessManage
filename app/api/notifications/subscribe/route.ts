import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export const runtime = "nodejs";

type BrowserPushSubscription = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function readSubscription(body: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  const subscription = body as BrowserPushSubscription;
  if (
    typeof subscription.endpoint !== "string" ||
    typeof subscription.keys?.p256dh !== "string" ||
    typeof subscription.keys?.auth !== "string"
  ) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const subscription = readSubscription(await request.json());

    if (!subscription) {
      return Response.json(
        { error: "Invalid push subscription." },
        { status: 400 }
      );
    }

    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: user.id,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: request.headers.get("user-agent"),
        isActive: true,
        lastFailedAt: null,
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: request.headers.get("user-agent"),
      },
    });

    return Response.json({ data: { subscribed: true } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Push subscribe error:", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();
    const subscription = readSubscription(await request.json());

    if (!subscription) {
      return Response.json(
        { error: "Invalid push subscription." },
        { status: 400 }
      );
    }

    await db.pushSubscription.updateMany({
      where: { endpoint: subscription.endpoint },
      data: { isActive: false },
    });

    return Response.json({ data: { subscribed: false } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Push unsubscribe error:", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
