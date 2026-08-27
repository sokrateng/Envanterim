import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";

/**
 * Liste satırında görünen durum — saf ve testli.
 *
 * Satırda tek bir durum yeri var ama iki bilgi yarışıyor: ekipmanın yaşam
 * döngüsündeki durumu (kullanımda / serviste / pasif / satıldı) ve birine
 * zimmetli olup olmadığı. Zimmet kullanımın bir türü, ayrı bir durum değil;
 * bu yüzden yalnız "Kullanımda" iken onun yerine geçiyor — serviste olan bir
 * ekipmanın zimmetli görünmesi, nerede olduğu sorusunu yanlış cevaplardı.
 */

export type StatusTone = "green" | "orange" | "blue" | "muted";

export type StatusView = { label: string; tone: StatusTone };

const TONES: Record<ItemStatus, StatusTone> = {
  IN_USE: "green",
  IN_REPAIR: "orange",
  // Pasif ve satıldı bir uyarı değil, bir bitiş: renk taşımıyorlar.
  RETIRED: "muted",
  SOLD: "muted",
};

export function statusView(status: ItemStatus, assigned = false): StatusView {
  if (assigned && status === "IN_USE") {
    return { label: "Zimmetli", tone: "blue" };
  }
  return { label: ITEM_STATUS_LABELS[status], tone: TONES[status] };
}
