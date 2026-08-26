import { WARRANTY_LEAD_DAYS } from "@/lib/constants";
import { daysBetween, startOfDay } from "@/lib/warranty";

/**
 * Garanti hatırlatmasının planı — saf ve testli.
 *
 * Gönderim `src/lib/push.ts`'te, cron ucu `/api/cron/garanti`'de.
 * Damgalama gönderimden **önce** yapılır: Vercel Cron aynı işi yeniden
 * tetikleyebiliyor ve kullanıcı aynı uyarıyı iki kez alıyor (TUZAKLAR #28).
 */

export type ReminderTarget = {
  itemId: string;
  itemName: string;
  locationId: string;
  warrantyEndDate: Date;
};

export type PlannedReminder = ReminderTarget & {
  leadDays: number;
  daysLeft: number;
};

/** Bugün hangi ürün için hangi eşik gönderilmeli? */
export function planReminders(
  items: ReminderTarget[],
  now: Date = new Date(),
  leadDaysList: readonly number[] = WARRANTY_LEAD_DAYS,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];

  for (const item of items) {
    const daysLeft = daysBetween(now, item.warrantyEndDate);
    // Eşiğe tam olarak denk gelen gün gönderilir; erken ya da geç değil.
    // Kaçan gün bir sonraki eşikte yakalanır, iki kez gönderilmez.
    const lead = leadDaysList.find((days) => days === daysLeft);
    if (lead === undefined) continue;
    planned.push({ ...item, leadDays: lead, daysLeft });
  }

  return planned;
}

/** Sorgu penceresi: verilen eşiklerin denk geldiği günlerin tamamı. */
export function reminderWindow(
  now: Date = new Date(),
  leadDaysList: readonly number[] = WARRANTY_LEAD_DAYS,
): { start: Date; end: Date } {
  const sorted = [...leadDaysList].sort((a, b) => a - b);
  const first = startOfDay(now);
  const start = new Date(first);
  start.setDate(start.getDate() + (sorted[0] ?? 0));
  const end = new Date(first);
  end.setDate(end.getDate() + (sorted[sorted.length - 1] ?? 0) + 1);
  return { start, end };
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** Bildirim metni. Kısa: iOS kilit ekranında iki satır görünüyor. */
export function warrantyPushPayload(reminder: PlannedReminder): PushPayload {
  const gun =
    reminder.daysLeft === 0
      ? "bugün bitiyor"
      : `${reminder.daysLeft} gün sonra bitiyor`;

  return {
    title: "Garanti bitiyor",
    body: `${reminder.itemName} garantisi ${gun}.`,
    url: `/envanter/${reminder.itemId}`,
    // Aynı ürün ve eşik için tek bildirim: iki kez düşerse üst üste yığılmaz.
    tag: `garanti-${reminder.itemId}-${reminder.leadDays}`,
  };
}
