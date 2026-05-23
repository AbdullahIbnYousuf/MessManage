"use client";

import { useEffect, useState } from "react";

type ReminderState =
  | "checking"
  | "unsupported"
  | "blocked"
  | "disabled"
  | "enabled"
  | "saving";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export default function MealReminderSettings() {
  const [state, setState] = useState<ReminderState>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkSupport() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }

      try {
        await navigator.serviceWorker.register("/sw.js");
        const subscription = await getExistingSubscription();
        setState(subscription ? "enabled" : "disabled");
      } catch {
        setState("unsupported");
      }
    }

    void checkSupport();
  }, []);

  async function enableReminders() {
    setState("saving");
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") {
        setState("disabled");
        return;
      }

      const keyRes = await fetch("/api/notifications/vapid-public-key");
      const keyJson = (await keyRes.json()) as {
        data?: { publicKey: string };
        error?: string;
      };
      if (!keyRes.ok || !keyJson.data?.publicKey) {
        setMessage(keyJson.error ?? "Push notifications are not configured.");
        setState("disabled");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(keyJson.data.publicKey),
        }));

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Could not enable reminders.");
        setState("disabled");
        return;
      }

      setState("enabled");
      setMessage("Meal reminders are on for this device.");
    } catch {
      setMessage("Could not enable reminders on this device.");
      setState("disabled");
    }
  }

  async function disableReminders() {
    setState("saving");
    setMessage(null);

    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
        await subscription.unsubscribe();
      }

      setState("disabled");
      setMessage("Meal reminders are off for this device.");
    } catch {
      setMessage("Could not turn off reminders.");
      setState("enabled");
    }
  }

  if (state === "checking") {
    return (
      <div className="card" style={{ minHeight: 92 }}>
        <span className="spinner" />
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
          Meal Reminders
        </div>
        <div className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.35rem" }}>
          This browser does not support push reminders.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
          Meal Reminders
        </div>
        <div className="text-secondary" style={{ fontSize: "0.875rem", marginTop: "0.35rem", lineHeight: 1.45 }}>
          Get a reminder at night for tomorrow and 30 minutes before the morning deadline.
        </div>
      </div>

      {state === "blocked" ? (
        <div className="badge badge-warning" style={{ minHeight: 44, justifyContent: "center" }}>
          Notifications are blocked in this browser
        </div>
      ) : (
        <button
          className={`btn ${state === "enabled" ? "btn-secondary" : "btn-primary"}`}
          onClick={() =>
            state === "enabled"
              ? void disableReminders()
              : void enableReminders()
          }
          disabled={state === "saving"}
          style={{ minHeight: 44, width: "100%", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          {state === "saving" ? (
            <span className="spinner" />
          ) : state === "enabled" ? (
            "Turn Off Reminders"
          ) : (
            "Enable Reminders"
          )}
        </button>
      )}

      {message && (
        <div
          className={state === "enabled" ? "text-positive" : "text-secondary"}
          style={{ fontSize: "0.8125rem" }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
