import { describe, expect, it } from "vitest";
import { CATEGORY_EMOJI, LOCATION_EMOJI, fold, suggestEmoji } from "./emoji";

describe("fold", () => {
  it("Türkçe harfleri bozmadan sadeleştirir", () => {
    // "İ".toLowerCase() birleştirici nokta üretiyor (TUZAKLAR #41).
    expect(fold("İŞ YERİ")).toBe("is yeri");
    expect(fold("Buzdolabı")).toBe("buzdolabi");
    expect(fold("ÇAMAŞIR")).toBe("camasir");
    expect(fold("  Klima  ")).toBe("klima");
  });
});

describe("suggestEmoji", () => {
  it("ad boşken kümenin kendisini verir", () => {
    expect(suggestEmoji("", "location")).toEqual(LOCATION_EMOJI);
    expect(suggestEmoji("", "category")).toEqual(CATEGORY_EMOJI);
  });

  it("eşleşeni başa alır", () => {
    expect(suggestEmoji("Buzdolabı", "category")[0]).toBe("🧊");
    expect(suggestEmoji("Klima", "category")[0]).toBe("❄️");
    expect(suggestEmoji("İş yeri", "location")[0]).toBe("🏢");
  });

  it("birden çok eşleşmede hepsi başta", () => {
    const öneri = suggestEmoji("Çamaşır ve bulaşık", "category");
    expect(öneri.slice(0, 2)).toEqual(["🧺", "🍽"]);
  });

  it("hiçbir şey atmaz, yalnız sıralar", () => {
    const öneri = suggestEmoji("Klima", "category");
    expect(öneri).toHaveLength(CATEGORY_EMOJI.length);
    expect([...öneri].sort()).toEqual([...CATEGORY_EMOJI].sort());
  });

  it("eşleşme yoksa sıra bozulmaz", () => {
    expect(suggestEmoji("zzz", "category")).toEqual(CATEGORY_EMOJI);
  });

  it("aynı emojiyi iki kez öne almaz", () => {
    const öneri = suggestEmoji("ocak ve kombi", "category");
    expect(öneri.filter((e) => e === "🔥")).toHaveLength(1);
  });
});
