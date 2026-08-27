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

/**
 * Filtre penceresi anahtarları. Sayılar gün: "90" = bugünle 90 gün sonrası
 * arasında bitenler. `bitmis` süresi dolmuş olanlar.
 */
export const WARRANTY_FILTERS = ["30", "90", "180", "365", "bitmis"] as const;
export type WarrantyFilter = (typeof WARRANTY_FILTERS)[number];

export const WARRANTY_FILTER_LABELS: Record<WarrantyFilter, string> = {
  "30": "30 gün içinde",
  "90": "90 gün içinde",
  "180": "180 gün içinde",
  "365": "1 yıl içinde",
  bitmis: "Süresi bitmiş",
};

/**
 * Filtre anahtarını tarih aralığına çevirir — sorgu koşulu buradan çıkıyor.
 *
 * Pencereler iç içe: 30 gün içinde bitenler 90'ın da içinde. Bu yüzden filtre
 * tek seçimli; birleşim zaten geniş olanı verirdi.
 *
 * Sınır günün başına normalize ediliyor: garanti tarihi yerel gün başı olarak
 * saklanıyor (`dateOnly`, TUZAKLAR #27), saat kalırsa bugün biten garanti
 * pencerenin dışında kalırdı. Üst sınır ertesi günün başı ve `lt`, böylece
 * son gün de içeride.
 *
 * Aralık koşulu tarihi olmayan ekipmanı kendiliğinden eliyor: SQL'de NULL
 * karşılaştırması doğru dönmüyor.
 */
export function warrantyRange(
  key: string,
  now: Date = new Date(),
): { gte?: Date; lt: Date } | null {
  if (!(WARRANTY_FILTERS as readonly string[]).includes(key)) return null;

  const today = startOfDay(now);
  if (key === "bitmis") return { lt: today };

  const end = new Date(today);
  end.setDate(end.getDate() + Number(key) + 1);
  return { gte: today, lt: end };
}
