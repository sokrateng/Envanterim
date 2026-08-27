import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

/**
 * "Ne değişti" özeti — saf ve testli.
 *
 * Bildirimde "ekipman güncellendi" demek işe yaramıyor; ne değiştiğini
 * söylemeyen haber, kullanıcıyı uygulamayı açıp aramaya zorluyor. Değişmeyen
 * alan listeye girmiyor.
 */

export type ItemSnapshot = {
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  place: string | null;
  status: string;
  purchaseDate: Date | null;
  purchasePriceMinor: number | null;
  currency: string;
  warrantyEndDate: Date | null;
  categoryName: string | null;
  sellerName: string | null;
};

/** GG.AA.YYYY — Intl'e bağlanmıyoruz, modül saf kalsın. */
export function formatDate(date: Date | null): string | null {
  if (!date) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/** Boş değerin okunur karşılığı: "—" ile "boş bırakıldı" aynı şeyi anlatıyor. */
const BOS = "—";

function line(label: string, before: string | null, after: string | null): string {
  return `${label}: ${before ?? BOS} → ${after ?? BOS}`;
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

export function describeChanges(
  before: ItemSnapshot,
  after: ItemSnapshot,
): string[] {
  const changes: string[] = [];

  if (before.name !== after.name) changes.push(line("Ad", before.name, after.name));
  if (before.brand !== after.brand) changes.push(line("Marka", before.brand, after.brand));
  if (before.model !== after.model) changes.push(line("Model", before.model, after.model));
  if (before.serialNo !== after.serialNo) {
    changes.push(line("Seri no", before.serialNo, after.serialNo));
  }
  if (before.categoryName !== after.categoryName) {
    changes.push(line("Kategori", before.categoryName, after.categoryName));
  }
  if (before.place !== after.place) changes.push(line("Yer", before.place, after.place));
  if (before.status !== after.status) {
    changes.push(
      line(
        "Durum",
        ITEM_STATUS_LABELS[before.status as ItemStatus] ?? before.status,
        ITEM_STATUS_LABELS[after.status as ItemStatus] ?? after.status,
      ),
    );
  }
  if (before.sellerName !== after.sellerName) {
    changes.push(line("Satıcı", before.sellerName, after.sellerName));
  }
  if (!sameDay(before.purchaseDate, after.purchaseDate)) {
    changes.push(
      line("Alış tarihi", formatDate(before.purchaseDate), formatDate(after.purchaseDate)),
    );
  }
  if (!sameDay(before.warrantyEndDate, after.warrantyEndDate)) {
    changes.push(
      line(
        "Garanti bitişi",
        formatDate(before.warrantyEndDate),
        formatDate(after.warrantyEndDate),
      ),
    );
  }
  // Tutar ve birim tek satır: birim değişince tutar da başka bir şey oluyor.
  if (
    before.purchasePriceMinor !== after.purchasePriceMinor ||
    before.currency !== after.currency
  ) {
    changes.push(
      line(
        "Alış tutarı",
        before.purchasePriceMinor === null
          ? null
          : formatMoney(before.purchasePriceMinor, before.currency),
        after.purchasePriceMinor === null
          ? null
          : formatMoney(after.purchasePriceMinor, after.currency),
      ),
    );
  }

  return changes;
}

/** Bildirim gövdesi: ilk iki değişiklik, kalanı sayıyla. */
export function changeSummary(changes: string[], limit = 2): string {
  if (changes.length === 0) return "Ayrıntı değişmedi";
  const shown = changes.slice(0, limit).join(" · ");
  const rest = changes.length - limit;
  return rest > 0 ? `${shown} · +${rest} değişiklik` : shown;
}
