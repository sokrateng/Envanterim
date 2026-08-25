/**
 * Garanti gün hesabı. Saat dilimi kayması TUZAKLAR #27'de yaşandı:
 * karşılaştırma tek yerde ve günün başına normalize edilerek yapılır.
 */

/** Yerel saatle günün başı (00:00). Aynı gün → aynı değer. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const MS_PER_DAY = 86_400_000;

/**
 * İki tarih arasındaki tam gün farkı. Saat/dakika değil, gün sınırı sayılır;
 * yaz saati geçişinde 23 veya 25 saatlik günler olduğu için yuvarlanır.
 */
export function daysBetween(from: Date, to: Date): number {
  const diff = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(diff / MS_PER_DAY) || 0; // -0 sızmasın (TUZAKLAR #15)
}

/** Bugüne göre kalan garanti günü. Bugün bitiyorsa 0, dün bittiyse -1. */
export function daysUntilWarrantyEnd(
  warrantyEndDate: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!warrantyEndDate) return null;
  return daysBetween(now, warrantyEndDate);
}

export type WarrantyState = "none" | "expired" | "ending-soon" | "active";

export type WarrantyStatus = {
  state: WarrantyState;
  daysLeft: number | null;
  label: string;
};

/** Rozet metni ve durumu — arayüz bunu doğrudan kullanır. */
export function warrantyStatus(
  warrantyEndDate: Date | null | undefined,
  now: Date = new Date(),
  soonDays = 30,
): WarrantyStatus {
  const daysLeft = daysUntilWarrantyEnd(warrantyEndDate, now);

  if (daysLeft === null) {
    return { state: "none", daysLeft: null, label: "Garanti bilgisi yok" };
  }
  if (daysLeft < 0) {
    return { state: "expired", daysLeft, label: "Garanti bitti" };
  }
  if (daysLeft === 0) {
    return { state: "ending-soon", daysLeft, label: "Garanti bugün bitiyor" };
  }
  if (daysLeft <= soonDays) {
    return { state: "ending-soon", daysLeft, label: `${daysLeft} gün garanti` };
  }
  return { state: "active", daysLeft, label: `${daysLeft} gün garanti` };
}

/**
 * Hatırlatmanın bugün gönderilmesi gerekiyor mu?
 * Cron günde bir koşar ve iki kez tetiklenebilir (TUZAKLAR #28) — gönderim
 * damgası bu fonksiyonun dışında, gönderimden önce yazılır.
 */
export function isReminderDue(
  dueDate: Date,
  leadDays: number,
  now: Date = new Date(),
): boolean {
  const daysLeft = daysBetween(now, dueDate);
  return daysLeft <= leadDays && daysLeft >= 0;
}
