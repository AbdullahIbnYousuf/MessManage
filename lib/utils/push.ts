import webpush from "web-push";

type PushKeys = {
  p256dh: string;
  auth: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

let configured = false;

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

export function hasWebPushConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configureWebPush(): void {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Web Push VAPID environment variables are not configured.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function toWebPushSubscription(subscription: StoredPushSubscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    } satisfies PushKeys,
  };
}

export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: PushPayload
): Promise<{ invalidSubscription: boolean }> {
  configureWebPush();

  try {
    await webpush.sendNotification(
      toWebPushSubscription(subscription),
      JSON.stringify(payload)
    );
    return { invalidSubscription: false };
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;

    if (statusCode === 404 || statusCode === 410) {
      return { invalidSubscription: true };
    }

    throw error;
  }
}
