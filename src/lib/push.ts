import "server-only";

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import type { PushPayload } from "@/lib/reminders";

/**
 * Web push gönderimi (MIMARI §4). VAPID anahtarları yoksa özellik kapalı;
 * arayüz de kapalıysa hiç görünmüyor.
 *
 * İki kural: gönderimi **await et** — sunucusuz fonksiyon yanıttan sonra iş
 * yapmıyor (TUZAKLAR #1); `410 Gone` dönen aboneliği **sil** — yoksa her
 * turda başarısız gönderim birikiyor (#29).
 */
let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:envanter@example.com";

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export type SendResult = { sent: number; removed: number };

/** Verilen kullanıcıların tüm cihazlarına gönderir. */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured() || userIds.length === 0) {
    return { sent: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  // Sıra değil, hepsi birlikte — ama tamamı await ediliyor.
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: abonelik ölmüş. Kullanıcı bildirimi kapatmış ya da tarayıcı
        // aboneliği yenilemiş olabilir.
        if (status === 404 || status === 410) {
          dead.push(subscription.id);
          return;
        }
        console.error("push gönderilemedi", status, (error as Error).message);
      }
    }),
  );

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }

  return { sent, removed: dead.length };
}
