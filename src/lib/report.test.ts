import { describe, expect, it } from "vitest";
import {
  UNCATEGORIZED,
  coverageNotes,
  reportable,
  sortForReport,
  summarize,
  type ReportItem,
} from "./report";

const now = new Date(2026, 2, 14);

const item = (over: Partial<ReportItem> = {}): ReportItem => ({
  id: Math.random().toString(36).slice(2),
  name: "Ekipman",
  brand: null,
  model: null,
  serialNo: null,
  categoryName: null,
  place: null,
  status: "IN_USE",
  purchaseDate: new Date(2025, 0, 10),
  purchasePriceMinor: 100000,
  currency: "TRY",
  warrantyEndDate: null,
  photoUrl: null,
  events: [],
  partPricesMinor: [],
  ...over,
});

describe("reportable", () => {
  it("emekli ve satılmışı raporlamaz", () => {
    const items = [
      item({ status: "IN_USE" }),
      item({ status: "IN_REPAIR" }),
      item({ status: "RETIRED" }),
      item({ status: "SOLD" }),
    ];
    expect(reportable(items).map((i) => i.status)).toEqual(["IN_USE", "IN_REPAIR"]);
  });
});

describe("summarize", () => {
  it("alış toplamını ve kapsamı verir", () => {
    const summary = summarize(
      [
        item({ purchasePriceMinor: 1840050 }),
        item({ purchasePriceMinor: 2499990 }),
        item({ purchasePriceMinor: null }),
      ],
      now,
    );
    expect(summary.itemCount).toBe(3);
    expect(summary.pricedCount).toBe(2);
    expect(summary.byCurrency).toHaveLength(1);
    expect(summary.byCurrency[0].purchaseTotalMinor).toBe(1840050 + 2499990);
  });

  it("sahip olma maliyetine servis ve parçayı katar", () => {
    const summary = summarize(
      [
        item({
          purchasePriceMinor: 100000,
          events: [
            { kind: "SERVICE", costMinor: 25000 },
            { kind: "LOG", costMinor: 999 },
          ],
          partPricesMinor: [5000, null],
        }),
      ],
      now,
    );
    expect(summary.byCurrency[0].ownershipTotalMinor).toBe(130000);
  });

  it("kategoriye göre kırar ve değerliyi üste alır", () => {
    const summary = summarize(
      [
        item({ categoryName: "Beyaz eşya", purchasePriceMinor: 500000 }),
        item({ categoryName: "Bilgisayar", purchasePriceMinor: 900000 }),
        item({ categoryName: "Beyaz eşya", purchasePriceMinor: 100000 }),
        item({ categoryName: null, purchasePriceMinor: 1000 }),
      ],
      now,
    );
    expect(summary.byCurrency[0].byCategory.map((c) => c.name)).toEqual([
      "Bilgisayar",
      "Beyaz eşya",
      UNCATEGORIZED,
    ]);
    expect(summary.byCurrency[0].byCategory[1]).toEqual({
      name: "Beyaz eşya",
      count: 2,
      purchaseMinor: 600000,
    });
  });

  it("fotoğraflı ve garantisi süren sayısını verir", () => {
    const summary = summarize(
      [
        item({ photoUrl: "/a.jpg", warrantyEndDate: new Date(2026, 5, 1) }),
        item({ warrantyEndDate: new Date(2025, 5, 1) }),
        item({ photoUrl: "/b.jpg" }),
      ],
      now,
    );
    expect(summary.withPhoto).toBe(2);
    expect(summary.warrantyActive).toBe(1);
  });

  it("boş listede sıfırlar", () => {
    const summary = summarize([], now);
    expect(summary).toMatchObject({ itemCount: 0, pricedCount: 0, byCurrency: [] });
  });

  it("para birimlerini ayrı toplar, karıştırmaz", () => {
    const summary = summarize(
      [
        item({ currency: "TRY", purchasePriceMinor: 100000 }),
        item({ currency: "USD", purchasePriceMinor: 50000 }),
        item({ currency: "USD", purchasePriceMinor: 30000 }),
      ],
      now,
    );

    expect(summary.itemCount).toBe(3);
    // Toplamı büyük birim üstte.
    expect(summary.byCurrency.map((g) => [g.currency, g.purchaseTotalMinor])).toEqual([
      ["TRY", 100000],
      ["USD", 80000],
    ]);
  });

  it("birden çok para birimi varsa kapsam notu düşer", () => {
    const notes = coverageNotes(
      summarize(
        [
          item({ currency: "TRY", photoUrl: "/a.jpg" }),
          item({ currency: "EUR", photoUrl: "/b.jpg" }),
        ],
        now,
      ),
    );
    expect(notes.some((note) => note.includes("kur çevirisi yapılmadı"))).toBe(true);
  });
});

describe("sortForReport", () => {
  it("değerliyi üste, tutarsızı sona alır", () => {
    const sorted = sortForReport([
      item({ name: "Ucuz", purchasePriceMinor: 1000 }),
      item({ name: "Tutarsız", purchasePriceMinor: null }),
      item({ name: "Pahalı", purchasePriceMinor: 90000 }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(["Pahalı", "Ucuz", "Tutarsız"]);
  });

  it("eşit tutarda Türkçe alfabeye göre sıralar", () => {
    const sorted = sortForReport([
      item({ name: "Ütü", purchasePriceMinor: 100 }),
      item({ name: "Çaydanlık", purchasePriceMinor: 100 }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(["Çaydanlık", "Ütü"]);
  });

  it("girdiyi bozmaz", () => {
    const items = [item({ name: "A", purchasePriceMinor: 1 }), item({ name: "B", purchasePriceMinor: 2 })];
    sortForReport(items);
    expect(items[0].name).toBe("A");
  });
});

describe("coverageNotes", () => {
  it("eksik tutar ve fotoğrafı söyler", () => {
    const summary = summarize(
      [item({ purchasePriceMinor: null }), item({ photoUrl: "/a.jpg" })],
      now,
    );
    const notes = coverageNotes(summary);
    expect(notes[0]).toContain("1 ekipmanın alış tutarı girilmemiş");
    expect(notes[1]).toContain("1 ekipmanın fotoğrafı yok");
  });

  it("eksik yoksa not yok", () => {
    const summary = summarize([item({ photoUrl: "/a.jpg" })], now);
    expect(coverageNotes(summary)).toEqual([]);
  });
});
