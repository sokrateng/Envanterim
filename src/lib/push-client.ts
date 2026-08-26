"use client";

/**
 * Tarayıcı tarafı abonelik. iOS Safari'de `window.Notification` sekmede
 * tanımsız olabiliyor; doğrudan erişmek patlıyor (TUZAKLAR #9) — bu yüzden
 * her şey varlık kontrolünden geçiyor.
 */
export type PushSupport =
  | { supported: true; permission: NotificationPermission }
  | { supported: false; reason: string };

export function checkSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Tarayıcı gerekli" };
  }
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "Bu tarayıcı bildirim desteklemiyor" };
  }
  if (!("PushManager" in window)) {
    return { supported: false, reason: "Bu tarayıcı bildirim desteklemiyor" };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "Bu tarayıcı bildirim desteklemiyor" };
  }
  // iOS'ta bildirim yalnız ana ekrana eklenmiş uygulamada çalışıyor.
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (iOS && !standalone) {
    return {
      supported: false,
      reason:
        "iPhone'da bildirim için uygulamayı Paylaş → Ana Ekrana Ekle ile ekle",
    };
  }
  return { supported: true, permission: Notification.permission };
}

/** VAPID açık anahtarı base64url; PushManager Uint8Array istiyor. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function subscribe(publicKey: string): Promise<string> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bildirim izni verilmedi");

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const response = await fetch("/api/push/abonelik", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.hata ?? "Abonelik kaydedilemedi");
  }

  return subscription.endpoint;
}

export async function unsubscribe(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/abonelik", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

export async function currentEndpoint(): Promise<string | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}
