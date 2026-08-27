import { describe, expect, it } from "vitest";
import { convertToTry, tryTotal } from "@/lib/exchange";

describe("convertToTry", () => {
  it("kuruş cinsinden çevirir", () => {
    // 100,00 USD · 34,50 ₺ = 3.450,00 ₺
    expect(convertToTry(10_000, 3450)).toBe(345_000);
  });

  it("TRY kendisiyle çarpılınca değişmiyor", () => {
    expect(convertToTry(18_400_50, 100)).toBe(18_400_50);
  });

  it("yarım kuruşu yukarı yuvarlar", () => {
    // 0,01 USD · 34,55 ₺ = 0,3455 ₺ → 35 kuruş
    expect(convertToTry(1, 3455)).toBe(35);
  });
});

describe("tryTotal", () => {
  const totals = [
    { currency: "TRY", minor: 100_000 },
    { currency: "USD", minor: 10_000 },
    { currency: "EUR", minor: 5_000 },
  ];

  it("kuru olanları toplar, olmayanı dışarıda bırakır", () => {
    // Eksik kuru bir varsaymak toplamı sessizce yanlışlardı: EUR dışarıda
    // kalıyor ve bunu söylüyoruz.
    const sonuc = tryTotal(totals, { USD: 3450 });
    expect(sonuc.minor).toBe(100_000 + 345_000);
    expect(sonuc.converted).toEqual(["TRY", "USD"]);
    expect(sonuc.missing).toEqual(["EUR"]);
  });

  it("TRY için kur istemiyor", () => {
    const sonuc = tryTotal([{ currency: "TRY", minor: 250 }], {});
    expect(sonuc.minor).toBe(250);
    expect(sonuc.missing).toEqual([]);
  });

  it("sıfır ve eksi kuru yok sayar", () => {
    const sonuc = tryTotal([{ currency: "USD", minor: 10_000 }], {
      USD: 0,
    });
    expect(sonuc.minor).toBe(0);
    expect(sonuc.missing).toEqual(["USD"]);
    expect(tryTotal([{ currency: "USD", minor: 1 }], { USD: -5 }).missing).toEqual([
      "USD",
    ]);
  });

  it("boş listede sıfır", () => {
    expect(tryTotal([], {})).toEqual({ minor: 0, converted: [], missing: [] });
  });
});
