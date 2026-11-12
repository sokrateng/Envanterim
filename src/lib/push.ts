import "server-only";

import webpush from "web-push";
import { resolvePushContact } from "@/lib/app-settings";
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
function vapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

/** Anahtarlar tanımlı mı. İletişim adresi her gönderimde ayrıca çözülüyor. */
export function isPushConfigured(): boolean {
  return vapidKeys() !== null;
}

export type SendResult = { sent: number; removed: number };

/** Verilen kullanıcıların tüm cihazlarına gönderir. */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  const keys = vapidKeys();
  if (!keys || userIds.length === 0) {
    return { sent: 0, removed: 0 };
  }

  // İletişim adresi ekrandan değiştirilebiliyor (Sistem → Bildirimler): her
  // gönderimde okunuyor, servisi yeniden başlatmak gerekmiyor.
  const { subject } = await resolvePushContact();
  try {
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  } catch (error) {
    // Bozuk anahtar bütün özelliği düşürmesin: bildirim gitmez, uygulama
    // çalışmaya devam eder.
    console.error("VAPID anahtarları geçersiz:", (error as Error).message);
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
