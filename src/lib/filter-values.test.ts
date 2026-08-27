import { describe, expect, it } from "vitest";
import { parseValues, toParam, toggleValue } from "@/lib/filter-values";

const DURUMLAR = ["IN_USE", "IN_REPAIR", "RETIRED", "SOLD"] as const;

describe("parseValues", () => {
  it("virgüllü listeyi ayırır", () => {
    expect(parseValues("IN_USE,IN_REPAIR", DURUMLAR)).toEqual([
      "IN_USE",
      "IN_REPAIR",
    ]);
  });

  it("izinli küme dışını eler", () => {
    // Adres çubuğu kullanıcının elinde; uydurma değer sorguya girmemeli.
    expect(parseValues("IN_USE,DROP TABLE,IN_REPAIR", DURUMLAR)).toEqual([
      "IN_USE",
      "IN_REPAIR",
    ]);
    expect(parseValues("yok", DURUMLAR)).toEqual([]);
  });

  it("boşluk ve tekrarları temizler", () => {
    expect(parseValues(" IN_USE , IN_USE ,IN_REPAIR", DURUMLAR)).toEqual([
      "IN_USE",
      "IN_REPAIR",
    ]);
  });

  it("izinli küme verilmezse boyu ve sayıyı sınırlar", () => {
    // Kategori kimlikleri sorgudan önce bilinmiyor; satırlar zaten üye olunan
    // lokasyonlarla sınırlı, ama adres yine de şişirilememeli.
    expect(parseValues("abc,def", null)).toEqual(["abc", "def"]);
    expect(parseValues("x".repeat(65), null)).toEqual([]);
    const cok = Array.from({ length: 50 }, (_, i) => `k${i}`).join(",");
    expect(parseValues(cok, null)).toHaveLength(30);
  });

  it("boş girdide boş liste verir", () => {
    expect(parseValues(undefined, DURUMLAR)).toEqual([]);
    expect(parseValues("", DURUMLAR)).toEqual([]);
    expect(parseValues(",,", DURUMLAR)).toEqual([]);
  });
});

describe("toParam", () => {
  it("boş seçimde parametre yazmıyor", () => {
    expect(toParam([])).toBeUndefined();
  });

  it("seçimi virgülle birleştirir", () => {
    expect(toParam(["IN_USE", "SOLD"])).toBe("IN_USE,SOLD");
  });
});

describe("toggleValue", () => {
  it("seçili olmayanı ekler, seçiliyi çıkarır", () => {
    expect(toggleValue([], "IN_USE")).toEqual(["IN_USE"]);
    expect(toggleValue(["IN_USE"], "IN_USE")).toEqual([]);
  });

  it("sırayı korur", () => {
    const secim = toggleValue(toggleValue(["SOLD"], "IN_USE"), "IN_REPAIR");
    expect(secim).toEqual(["SOLD", "IN_USE", "IN_REPAIR"]);
    expect(toggleValue(secim, "IN_USE")).toEqual(["SOLD", "IN_REPAIR"]);
  });
});
