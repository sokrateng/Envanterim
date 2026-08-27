import { ownershipCostMinor, type TimelineEvent } from "@/lib/events";
import { sumMinor } from "@/lib/money";
import { warrantyStatus } from "@/lib/warranty";

/**
 * Sigorta raporu özeti — saf ve testli.
 *
 * Yangın, hırsızlık, sel durumunda sigortaya verilecek belge: neyin ne zaman
 * ne kadara alındığı, fotoğrafıyla (docs/URUN.md). Toplamlar saklanmıyor,
 * hesaplanıyor (CLAUDE.md).
 */

export type ReportItem = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  categoryName: string | null;
  place: string | null;
  status: string;
  purchaseDate: Date | null;
  purchasePriceMinor: number | null;
  /** Tutarın birimi; farklı birimler toplanmıyor. */
  currency: string;
  warrantyEndDate: Date | null;
  photoUrl: string | null;
  events: Array<Pick<TimelineEvent, "kind" | "costMinor">>;
  partPricesMinor: Array<number | null>;
  /** Yetkili servis ücretleri; garanti kapsamındakiler dışarıda bırakılmış. */
  servicePricesMinor: Array<number | null>;
};

export type CategoryTotal = {
  name: string;
  count: number;
  purchaseMinor: number;
};

/**
 * Bir para birimindeki toplamlar.
 *
 * Kur çevirisi yapmıyoruz: kur alış anına ait, bugünkü kurla çevirmek sigortaya
 * verilecek belgeye uydurma bir sayı koyar. Farklı birimler ayrı satırlarda.
 */
export type CurrencyGroup = {
  currency: string;
  itemCount: number;
  pricedCount: number;
  purchaseTotalMinor: number;
  ownershipTotalMinor: number;
  byCategory: CategoryTotal[];
};

export type ReportSummary = {
  itemCount: number;
  /** Alış tutarı girilmiş ekipman sayısı — toplamın kapsamı bu. */
  pricedCount: number;
  withPhoto: number;
  warrantyActive: number;
  byCurrency: CurrencyGroup[];
};

/** Raporda sayılacak ekipmanlar: elden çıkanlar sigortaya yazılmaz. */
export function reportable(items: ReportItem[]): ReportItem[] {
  return items.filter(
    (item) => item.status === "IN_USE" || item.status === "IN_REPAIR",
  );
}

export const UNCATEGORIZED = "Kategorisiz";

function groupCurrency(items: ReportItem[]): CurrencyGroup {
  const byCategory = new Map<string, CategoryTotal>();

  for (const item of items) {
    const key = item.categoryName ?? UNCATEGORIZED;
    const entry = byCategory.get(key) ?? { name: key, count: 0, purchaseMinor: 0 };
    entry.count += 1;
    entry.purchaseMinor += item.purchasePriceMinor ?? 0;
    byCategory.set(key, entry);
  }

  return {
    currency: items[0]?.currency ?? "TRY",
    itemCount: items.length,
    pricedCount: items.filter((item) => item.purchasePriceMinor != null).length,
    purchaseTotalMinor: sumMinor(items.map((item) => item.purchasePriceMinor)),
    ownershipTotalMinor: items.reduce(
      (total, item) =>
        total +
        ownershipCostMinor(
          item.purchasePriceMinor,
          item.events,
          item.partPricesMinor,
          item.servicePricesMinor,
        ),
      0,
    ),
    // Değeri yüksek kategori üstte: sigortacı önce oraya bakıyor.
    byCategory: [...byCategory.values()].sort(
      (a, b) => b.purchaseMinor - a.purchaseMinor || a.name.localeCompare(b.name, "tr"),
    ),
  };
}

export function summarize(
  items: ReportItem[],
  now: Date = new Date(),
): ReportSummary {
  const buckets = new Map<string, ReportItem[]>();
  for (const item of items) {
    const key = item.currency || "TRY";
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }

  return {
    itemCount: items.length,
    pricedCount: items.filter((item) => item.purchasePriceMinor != null).length,
    withPhoto: items.filter((item) => item.photoUrl).length,
    warrantyActive: items.filter((item) => {
      const state = warrantyStatus(item.warrantyEndDate, now).state;
      return state === "active" || state === "ending-soon";
    }).length,
    // Toplamı büyük birim üstte; tek birimli envanterde zaten tek satır.
    byCurrency: [...buckets.values()]
      .map(groupCurrency)
      .sort(
        (a, b) =>
          b.purchaseTotalMinor - a.purchaseTotalMinor ||
          a.currency.localeCompare(b.currency),
      ),
  };
}

/** Rapor satırı: fotoğrafsız ve tutarsız olanlar sona, değerli olanlar üste. */
export function sortForReport(items: ReportItem[]): ReportItem[] {
  return [...items].sort(
    (a, b) =>
      (b.purchasePriceMinor ?? -1) - (a.purchasePriceMinor ?? -1) ||
      a.name.localeCompare(b.name, "tr"),
  );
}

/** Kapsam uyarısı: eksik veri raporun altında açıkça yazılmalı. */
export function coverageNotes(summary: ReportSummary): string[] {
  const notes: string[] = [];

  const missingPrice = summary.itemCount - summary.pricedCount;
  if (missingPrice > 0) {
    notes.push(
      `${missingPrice} ekipmanın alış tutarı girilmemiş; toplam değere dahil değil.`,
    );
  }

  const missingPhoto = summary.itemCount - summary.withPhoto;
  if (missingPhoto > 0) {
    notes.push(`${missingPhoto} ekipmanın fotoğrafı yok.`);
  }

  if (summary.byCurrency.length > 1) {
    const codes = summary.byCurrency.map((group) => group.currency).join(", ");
    notes.push(
      `Envanterde ${codes} olmak üzere birden çok para birimi var; toplamlar ayrı verildi, kur çevirisi yapılmadı.`,
    );
  }

  return notes;
}
