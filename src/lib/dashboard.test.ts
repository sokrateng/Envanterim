import { describe, expect, it } from "vitest";
import {
  activeItems,
  byPurchaseYear,
  coverage,
  currencyTotals,
  rankBy,
  statusBreakdown,
  topValued,
  warrantyBreakdown,
} from "@/lib/dashboard";
import type { ReportItem } from "@/lib/report";

const item = (over: Partial<ReportItem> = {}): ReportItem => ({
  id: over.id ?? "i1",
  name: "Çamaşır makinesi",
  brand: "Bosch",
  model: null,
  serialNo: null,
  categoryName: "Beyaz eşya",
  place: null,
  status: "IN_USE",
  purchaseDate: null,
  purchasePriceMinor: null,
  currency: "TRY",
  warrantyEndDate: null,
  photoUrl: null,
  events: [],
  partPricesMinor: [],
  servicePricesMinor: [],
  ...over,
});

const now = new Date(2026, 2, 14);
const gunSonra = (gun: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + gun);
  return d;
};

describe("activeItems", () => {
  it("elden çıkmış ekipmanı ayıklar", () => {
    // Satılmış ekipmanın alış bedelini "sahip olduğun değer" toplamına
    // koymak yanlış olurdu.
    const items = [
      item({ id: "a", status: "IN_USE" }),
      item({ id: "b", status: "IN_REPAIR" }),
      item({ id: "c", status: "RETIRED" }),
      item({ id: "d", status: "SOLD" }),
    ];
    expect(activeItems(items).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("statusBreakdown", () => {
  it("zimmeti kullanımın türü sayar, listedeki gibi", () => {
    const rows = statusBreakdown([
      { ...item({ id: "a" }), assigned: true },
      { ...item({ id: "b" }) },
      { ...item({ id: "c", status: "IN_REPAIR" }), assigned: true },
    ]);
    const etiketler = rows.map((r) => `${r.label}:${r.count}`);
    // Serviste olan zimmetli ekipman "Serviste" kalıyor: nerede olduğu
    // sorusunun cevabı o.
    expect(etiketler).toEqual(["Kullanımda:1", "Zimmetli:1", "Serviste:1"]);
  });

  it("payları toplam üzerinden verir ve sırayı sabit tutar", () => {
    const rows = statusBreakdown([
      item({ id: "a", status: "SOLD" }),
      item({ id: "b" }),
      item({ id: "c" }),
      item({ id: "d" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Kullanımda", "Satıldı"]);
    expect(rows[0]).toMatchObject({ count: 3, share: 75, tone: "green" });
  });

  it("boş listede boş", () => {
    expect(statusBreakdown([])).toEqual([]);
  });
});

describe("warrantyBreakdown", () => {
  it("ayrık kovalara böler", () => {
    // Filtredeki pencereler iç içeydi (30 ⊂ 90); burada ayrık, yoksa
    // yüzdeler toplamı yüzü geçerdi.
    const rows = warrantyBreakdown(
      [
        item({ id: "a", warrantyEndDate: gunSonra(-1) }),
        item({ id: "b", warrantyEndDate: gunSonra(10) }),
        item({ id: "c", warrantyEndDate: gunSonra(60) }),
        item({ id: "d", warrantyEndDate: gunSonra(200) }),
        item({ id: "e", warrantyEndDate: gunSonra(800) }),
        item({ id: "f" }),
      ],
      now,
    );
    expect(rows.map((r) => `${r.key}:${r.count}`)).toEqual([
      "bitmis:1",
      "30:1",
      "90:1",
      "365:1",
      "uzun:1",
      "yok:1",
    ]);
    // Kovalar ayrık: her ekipman tam bir satırda sayılıyor. (Yüzdeler
    // yuvarlandığı için toplamları yüzü birkaç puan aşabiliyor; kartta öne
    // çıkan sayı adet, yüzde onun yanında duruyor.)
    expect(rows.reduce((t, r) => t + r.count, 0)).toBe(6);
  });

  it("sınır günleri kovanın içinde", () => {
    const rows = warrantyBreakdown(
      [
        item({ id: "a", warrantyEndDate: gunSonra(0) }),
        item({ id: "b", warrantyEndDate: gunSonra(30) }),
        item({ id: "c", warrantyEndDate: gunSonra(31) }),
      ],
      now,
    );
    expect(rows.map((r) => `${r.key}:${r.count}`)).toEqual(["30:2", "90:1"]);
  });

  it("boş kovayı çizmiyor", () => {
    const rows = warrantyBreakdown([item({ warrantyEndDate: gunSonra(5) })], now);
    expect(rows).toHaveLength(1);
  });
});

describe("rankBy", () => {
  const items = [
    item({ id: "a", brand: "Bosch" }),
    item({ id: "b", brand: "Bosch" }),
    item({ id: "c", brand: "LG" }),
    item({ id: "d", brand: null }),
  ];

  it("çoktan aza sıralar, boşu etiketler", () => {
    const rows = rankBy(items, (i) => i.brand, { emptyLabel: "Markasız" });
    expect(rows.map((r) => `${r.label}:${r.count}:${r.share}`)).toEqual([
      "Bosch:2:50",
      "LG:1:25",
      "Markasız:1:25",
    ]);
  });

  it("kuyruğu Diğer'de toplar", () => {
    // Yirmi markalı envanterde kart ekranı yemesin; toplam yine yüzde yüz.
    const cok = Array.from({ length: 10 }, (_, i) =>
      item({ id: `x${i}`, brand: `Marka ${i}` }),
    );
    const rows = rankBy(cok, (i) => i.brand, { limit: 3, emptyLabel: "yok" });
    expect(rows).toHaveLength(4);
    expect(rows[3]).toMatchObject({ label: "Diğer", count: 7, groups: 7 });
  });

  it("boşlukları kırpar", () => {
    const rows = rankBy([item({ brand: "  Bosch " })], (i) => i.brand, {
      emptyLabel: "yok",
    });
    expect(rows[0].label).toBe("Bosch");
  });
});

describe("currencyTotals", () => {
  it("birim başına alış ve sahip olma maliyetini toplar", () => {
    const rows = currencyTotals([
      item({
        id: "a",
        purchasePriceMinor: 100_000,
        servicePricesMinor: [25_000],
      }),
      item({ id: "b", purchasePriceMinor: 50_000 }),
      item({ id: "c", currency: "USD", purchasePriceMinor: 20_000 }),
      item({ id: "d", currency: "USD" }),
    ]);
    expect(rows[0]).toMatchObject({
      currency: "TRY",
      itemCount: 2,
      pricedCount: 2,
      purchaseMinor: 150_000,
      ownershipMinor: 175_000,
    });
    expect(rows[1]).toMatchObject({
      currency: "USD",
      itemCount: 2,
      pricedCount: 1,
      purchaseMinor: 20_000,
    });
  });

  it("farklı birimleri toplamıyor", () => {
    const rows = currencyTotals([
      item({ currency: "TRY", purchasePriceMinor: 1 }),
      item({ currency: "EUR", purchasePriceMinor: 1 }),
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe("topValued", () => {
  it("tutarı girilmemişleri dışarıda bırakır", () => {
    const rows = topValued(
      [
        item({ id: "a", name: "Ucuz", purchasePriceMinor: 100 }),
        item({ id: "b", name: "Pahalı", purchasePriceMinor: 900 }),
        item({ id: "c", name: "Tutarsız" }),
      ],
      2,
    );
    expect(rows.map((r) => r.name)).toEqual(["Pahalı", "Ucuz"]);
  });

  it("ayrıntı yoksa boş bırakmıyor", () => {
    const rows = topValued([
      item({ brand: null, categoryName: null, purchasePriceMinor: 1 }),
    ]);
    expect(rows[0].detail).toBe("Ayrıntı girilmemiş");
  });
});

describe("byPurchaseYear", () => {
  it("yıla göre sayar ve en yüksek yıla göre oranlar", () => {
    const rows = byPurchaseYear([
      item({ id: "a", purchaseDate: new Date(2024, 0, 5) }),
      item({ id: "b", purchaseDate: new Date(2026, 5, 1) }),
      item({ id: "c", purchaseDate: new Date(2026, 8, 1) }),
      item({ id: "d" }),
    ]);
    expect(rows).toEqual([
      { year: 2024, count: 1, share: 50 },
      { year: 2026, count: 2, share: 100 },
    ]);
  });

  it("tarihsizler hiç sayılmıyor", () => {
    expect(byPurchaseYear([item({}), item({})])).toEqual([]);
  });
});

describe("coverage", () => {
  it("eksik kaydı sayar", () => {
    const c = coverage([
      item({ id: "a", purchasePriceMinor: 1, photoUrl: "u", serialNo: "SN" }),
      item({ id: "b", warrantyEndDate: now, serialNo: "   " }),
    ]);
    expect(c).toEqual({
      total: 2,
      withPrice: 1,
      withPhoto: 1,
      withSerial: 1,
      withWarranty: 1,
    });
  });
});
