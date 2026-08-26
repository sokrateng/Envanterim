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
  warrantyEndDate: Date | null;
  photoUrl: string | null;
  events: Array<Pick<TimelineEvent, "kind" | "costMinor">>;
  partPricesMinor: Array<number | null>;
};

export type CategoryTotal = {
  name: string;
  count: number;
  purchaseMinor: number;
};

export type ReportSummary = {
  itemCount: number;
  /** Alış tutarı girilmiş ekipman sayısı — toplamın kapsamı bu. */
  pricedCount: number;
  purchaseTotalMinor: number;
  ownershipTotalMinor: number;
  withPhoto: number;
  warrantyActive: number;
  byCategory: CategoryTotal[];
};

/** Raporda sayılacak ekipmanlar: elden çıkanlar sigortaya yazılmaz. */
export function reportable(items: ReportItem[]): ReportItem[] {
  return items.filter(
    (item) => item.status === "IN_USE" || item.status === "IN_REPAIR",
  );
}

export const UNCATEGORIZED = "Kategorisiz";

export function summarize(
  items: ReportItem[],
  now: Date = new Date(),
): ReportSummary {
  const byCategory = new Map<string, CategoryTotal>();

  for (const item of items) {
    const key = item.categoryName ?? UNCATEGORIZED;
    const entry = byCategory.get(key) ?? { name: key, count: 0, purchaseMinor: 0 };
    entry.count += 1;
    entry.purchaseMinor += item.purchasePriceMinor ?? 0;
    byCategory.set(key, entry);
  }

  const ownershipTotalMinor = items.reduce(
    (total, item) =>
      total +
      ownershipCostMinor(item.purchasePriceMinor, item.events, item.partPricesMinor),
    0,
  );

  return {
    itemCount: items.length,
    pricedCount: items.filter((item) => item.purchasePriceMinor != null).length,
    purchaseTotalMinor: sumMinor(items.map((item) => item.purchasePriceMinor)),
    ownershipTotalMinor,
    withPhoto: items.filter((item) => item.photoUrl).length,
    warrantyActive: items.filter((item) => {
      const state = warrantyStatus(item.warrantyEndDate, now).state;
      return state === "active" || state === "ending-soon";
    }).length,
    // Değeri yüksek kategori üstte: sigortacı önce oraya bakıyor.
    byCategory: [...byCategory.values()].sort(
      (a, b) => b.purchaseMinor - a.purchaseMinor || a.name.localeCompare(b.name, "tr"),
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

  return notes;
}
