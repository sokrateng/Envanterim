import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";
import { ownershipCostMinor } from "@/lib/events";
import { statusView, type StatusTone } from "@/lib/item-status";
import { sumMinor } from "@/lib/money";
import type { ReportItem } from "@/lib/report";
import { daysUntilWarrantyEnd } from "@/lib/warranty";

/**
 * Panelin bütün sayıları — saf ve testli.
 *
 * Hiçbiri saklanmıyor, her açılışta hesaplanıyor (CLAUDE.md). Girdi sigorta
 * raporununkiyle aynı satır tipi (`ReportItem`): iki ekran aynı veriye baksın,
 * biri "12 ekipman" derken öteki "13" demesin.
 *
 * **Kapsam iki türlü.** Durum kartı bütün ekipmanları sayıyor — panelin bir işi
 * de "kaç tanesi elden çıkmış" sorusunu cevaplamak. Tutar, garanti, kategori ve
 * marka kartları ise yalnız elde olanlara (`aktif`) bakıyor: satılmış bir
 * ekipmanın alış bedelini "sahip olduğun değer" toplamına koymak yanlış olurdu.
 */

/** Yüzde: tam sayı, sıfıra bölmeye karşı korumalı. */
function share(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export type Slice = {
  key: string;
  label: string;
  count: number;
  /** Toplam içindeki pay, tam sayı yüzde. */
  share: number;
  tone: StatusTone;
};

/** Elde olanlar: pasif ve satılmış ekipman tutar toplamına girmiyor. */
export function activeItems(items: ReportItem[]): ReportItem[] {
  return items.filter(
    (item) => item.status === "IN_USE" || item.status === "IN_REPAIR",
  );
}

/**
 * Durum dağılımı — listedeki etiketlerin aynısı.
 *
 * Zimmet ayrı bir durum değil, kullanımın bir türü (`statusView`); panelde de
 * öyle sayılıyor, yoksa aynı ekipman listede "Zimmetli" panelde "Kullanımda"
 * görünürdü.
 */
export function statusBreakdown(
  items: Array<ReportItem & { assigned?: boolean }>,
): Slice[] {
  const sayac = new Map<string, Slice>();

  for (const item of items) {
    const view = statusView(item.status as ItemStatus, item.assigned ?? false);
    const entry = sayac.get(view.label) ?? {
      key: view.label,
      label: view.label,
      count: 0,
      share: 0,
      tone: view.tone,
    };
    entry.count += 1;
    sayac.set(view.label, entry);
  }

  // Sabit sıra: kart her açılışta aynı görünsün, sayılar oynadıkça satırlar
  // yer değiştirmesin.
  const sira = [
    ITEM_STATUS_LABELS.IN_USE,
    "Zimmetli",
    ITEM_STATUS_LABELS.IN_REPAIR,
    ITEM_STATUS_LABELS.RETIRED,
    ITEM_STATUS_LABELS.SOLD,
  ];

  return [...sayac.values()]
    .map((entry) => ({ ...entry, share: share(entry.count, items.length) }))
    .sort((a, b) => sira.indexOf(a.label) - sira.indexOf(b.label));
}

/**
 * Garanti dağılımı. Filtredeki pencereler iç içeydi (30 ⊂ 90); burada
 * **ayrık** kovalar var, yoksa yüzdeler toplamı yüzü geçerdi.
 */
export const WARRANTY_BUCKETS = [
  { key: "bitmis", label: "Garantisi bitmiş", tone: "muted" as StatusTone },
  { key: "30", label: "30 gün içinde bitiyor", tone: "orange" as StatusTone },
  { key: "90", label: "90 gün içinde bitiyor", tone: "orange" as StatusTone },
  { key: "365", label: "1 yıl içinde bitiyor", tone: "blue" as StatusTone },
  { key: "uzun", label: "1 yıldan uzun", tone: "green" as StatusTone },
  { key: "yok", label: "Garanti bilgisi yok", tone: "muted" as StatusTone },
] as const;

export function warrantyBreakdown(
  items: ReportItem[],
  now: Date = new Date(),
): Slice[] {
  const sayac = new Map<string, number>();

  for (const item of items) {
    const kalan = daysUntilWarrantyEnd(item.warrantyEndDate, now);
    const key =
      kalan === null
        ? "yok"
        : kalan < 0
          ? "bitmis"
          : kalan <= 30
            ? "30"
            : kalan <= 90
              ? "90"
              : kalan <= 365
                ? "365"
                : "uzun";
    sayac.set(key, (sayac.get(key) ?? 0) + 1);
  }

  // Boş kova çizilmiyor: "0 ekipman" satırı yer kaplayıp göz yoruyor.
  return WARRANTY_BUCKETS.filter((bucket) => sayac.get(bucket.key)).map(
    (bucket) => {
      const count = sayac.get(bucket.key) ?? 0;
      return {
        key: bucket.key,
        label: bucket.label,
        count,
        share: share(count, items.length),
        tone: bucket.tone,
      };
    },
  );
}

export type Ranked = {
  key: string;
  label: string;
  count: number;
  share: number;
  /** Yalnız "Diğer" satırında: kaç ayrı grup buraya toplandı. */
  groups?: number;
};

/**
 * Bir alana göre ilk N + "Diğer".
 *
 * Kuyruğu toplamak, yirmi markalı bir envanterde kartın ekranı yemesini
 * engelliyor; toplam yine yüzde yüz kalıyor.
 */
export function rankBy(
  items: ReportItem[],
  pick: (item: ReportItem) => string | null,
  { limit = 6, emptyLabel }: { limit?: number; emptyLabel: string },
): Ranked[] {
  const sayac = new Map<string, number>();
  for (const item of items) {
    const raw = pick(item)?.trim();
    const key = raw ? raw : emptyLabel;
    sayac.set(key, (sayac.get(key) ?? 0) + 1);
  }

  const sirali: Ranked[] = [...sayac.entries()]
    .map(([label, count]) => ({ key: label, label, count, share: 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"));

  const ilk = sirali.slice(0, limit);
  const kuyruk = sirali.slice(limit);
  if (kuyruk.length) {
    // Etikette iki sayı yan yana durmuyor: satırın sayısı adet, kaç grubun
    // toplandığı `groups` ile ayrıca söyleniyor — kart onu kendi diliyle
    // yazıyor ("20 kategori Diğer'de"). Sessizce kısaltmak, listeye bakan
    // kişiye "hepsi bu" dedirtirdi.
    ilk.push({
      key: "__diger__",
      label: "Diğer",
      count: kuyruk.reduce((total, row) => total + row.count, 0),
      share: 0,
      groups: kuyruk.length,
    });
  }

  return ilk.map((row) => ({ ...row, share: share(row.count, items.length) }));
}

export type CurrencyTotal = {
  currency: string;
  itemCount: number;
  /** Alış tutarı girilmiş ekipman sayısı — toplamın kapsamı bu. */
  pricedCount: number;
  purchaseMinor: number;
  /** Alış + servis + parça: sahip olma maliyeti. */
  ownershipMinor: number;
};

/**
 * Para birimi başına toplamlar. Çeviri burada **yapılmıyor**: kur bilgisi
 * kullanıcıdan geliyor ve tek bir TRY sayısı ondan sonra üretiliyor
 * (`src/lib/exchange.ts`). Uydurma kurla toplanan bir tutar, panele bakan
 * kişiyi yanlış bir sayıya inandırırdı.
 */
export function currencyTotals(items: ReportItem[]): CurrencyTotal[] {
  const kova = new Map<string, ReportItem[]>();
  for (const item of items) {
    const key = item.currency || "TRY";
    kova.set(key, [...(kova.get(key) ?? []), item]);
  }

  return [...kova.entries()]
    .map(([currency, group]) => ({
      currency,
      itemCount: group.length,
      pricedCount: group.filter((item) => item.purchasePriceMinor != null)
        .length,
      purchaseMinor: sumMinor(group.map((item) => item.purchasePriceMinor)),
      ownershipMinor: group.reduce(
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
    }))
    .sort(
      (a, b) =>
        b.purchaseMinor - a.purchaseMinor ||
        a.currency.localeCompare(b.currency),
    );
}

export type ValuedItem = {
  id: string;
  name: string;
  detail: string;
  minor: number;
  currency: string;
};

/** En değerli ekipmanlar: envanterin ağırlığı nerede duruyor. */
export function topValued(items: ReportItem[], limit = 5): ValuedItem[] {
  return items
    .filter((item) => item.purchasePriceMinor != null)
    .sort(
      (a, b) =>
        (b.purchasePriceMinor ?? 0) - (a.purchasePriceMinor ?? 0) ||
        a.name.localeCompare(b.name, "tr"),
    )
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      detail:
        [item.brand, item.categoryName].filter(Boolean).join(" · ") ||
        "Ayrıntı girilmemiş",
      minor: item.purchasePriceMinor ?? 0,
      currency: item.currency,
    }));
}

export type YearBar = { year: number; count: number; share: number };

/**
 * Alış yılına göre dağılım — envanterin yaş profili. Yenileme sırasının
 * kime geldiğini yıllara bakarak görmek, tek tek tarihlere bakmaktan kolay.
 */
export function byPurchaseYear(items: ReportItem[]): YearBar[] {
  const sayac = new Map<number, number>();
  for (const item of items) {
    if (!item.purchaseDate) continue;
    const year = item.purchaseDate.getFullYear();
    sayac.set(year, (sayac.get(year) ?? 0) + 1);
  }

  const enCok = Math.max(0, ...sayac.values());
  return [...sayac.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({
      year,
      count,
      // Pay en yüksek yıla göre: sütunun boyu yıllar arasında karşılaştırma
      // için, toplam içindeki oran için değil.
      share: share(count, enCok),
    }));
}

export type Coverage = {
  total: number;
  withPrice: number;
  withPhoto: number;
  withSerial: number;
  withWarranty: number;
};

/**
 * Kayıt eksikliği. Paneldeki her sayı girilen veriden geliyor; neyin eksik
 * olduğunu göstermeden verilen bir toplam, olduğundan küçük görünür.
 */
export function coverage(items: ReportItem[]): Coverage {
  return {
    total: items.length,
    withPrice: items.filter((item) => item.purchasePriceMinor != null).length,
    withPhoto: items.filter((item) => item.photoUrl).length,
    withSerial: items.filter((item) => item.serialNo?.trim()).length,
    withWarranty: items.filter((item) => item.warrantyEndDate).length,
  };
}
