import { describe, expect, it } from "vitest";
import {
  changeSummary,
  describeChanges,
  formatDate,
  type ItemSnapshot,
} from "@/lib/item-changes";

const temel = (over: Partial<ItemSnapshot> = {}): ItemSnapshot => ({
  name: "Çamaşır makinesi",
  brand: "Bosch",
  model: "WGG24400TR",
  serialNo: null,
  place: null,
  status: "IN_USE",
  purchaseDate: null,
  purchasePriceMinor: null,
  currency: "TRY",
  warrantyEndDate: null,
  categoryName: null,
  sellerName: null,
  ...over,
});

describe("describeChanges", () => {
  it("değişmeyen alanı listelemiyor", () => {
    expect(describeChanges(temel(), temel())).toEqual([]);
  });

  it("değişen alanı eski ve yeni değeriyle yazıyor", () => {
    const changes = describeChanges(temel(), temel({ name: "Kurutma makinesi" }));
    expect(changes).toEqual(["Ad: Çamaşır makinesi → Kurutma makinesi"]);
  });

  it("boş değeri tire ile gösteriyor", () => {
    expect(describeChanges(temel(), temel({ brand: null }))).toEqual([
      "Marka: Bosch → —",
    ]);
    expect(describeChanges(temel({ brand: null }), temel())).toEqual([
      "Marka: — → Bosch",
    ]);
  });

  it("durumu Türkçe etiketle yazıyor", () => {
    expect(describeChanges(temel(), temel({ status: "IN_REPAIR" }))).toEqual([
      "Durum: Kullanımda → Serviste",
    ]);
  });

  it("tarihi GG.AA.YYYY biçiminde yazıyor, aynı günü değişiklik saymıyor", () => {
    const gun = new Date(2026, 0, 31);
    expect(describeChanges(temel(), temel({ purchaseDate: gun }))).toEqual([
      "Alış tarihi: — → 31.01.2026",
    ]);
    expect(
      describeChanges(
        temel({ purchaseDate: new Date(2026, 0, 31) }),
        temel({ purchaseDate: new Date(2026, 0, 31) }),
      ),
    ).toEqual([]);
  });

  it("tutar ve para birimini tek satırda veriyor", () => {
    const changes = describeChanges(
      temel({ purchasePriceMinor: 100000, currency: "TRY" }),
      temel({ purchasePriceMinor: 100000, currency: "USD" }),
    );
    expect(changes).toEqual(["Alış tutarı: 1.000,00 ₺ → 1.000,00 $"]);
  });

  it("birden çok değişikliği sırayla veriyor", () => {
    const changes = describeChanges(
      temel(),
      temel({ name: "Yeni ad", place: "Mutfak", status: "RETIRED" }),
    );
    expect(changes).toHaveLength(3);
  });
});

describe("formatDate", () => {
  it("boş tarihte null", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(new Date(2026, 11, 5))).toBe("05.12.2026");
  });
});

describe("changeSummary", () => {
  it("hiç değişiklik yoksa bunu söylüyor", () => {
    expect(changeSummary([])).toBe("Ayrıntı değişmedi");
  });

  it("ilk ikisini yazıp kalanı sayıyor", () => {
    expect(changeSummary(["a", "b", "c", "d"])).toBe("a · b · +2 değişiklik");
    expect(changeSummary(["a", "b"])).toBe("a · b");
  });
});
