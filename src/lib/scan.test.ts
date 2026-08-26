import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, normalizePayload, readScan, scanSummary } from "./scan";
import { itemUrl } from "./qr";
import { shareUrl } from "./share";

const TOKEN = "a".repeat(32);

describe("normalizePayload", () => {
  it("sondaki satır sonunu ve boşluğu atar", () => {
    expect(normalizePayload("  SN-1234\r\n")).toBe("SN-1234");
  });

  it("sıfır genişlikli karakteri temizler", () => {
    expect(normalizePayload("SN​1234")).toBe("SN 1234");
  });
});

describe("readScan — kendi etiketimiz", () => {
  it("tam adresten ürün kimliğini çıkarır", () => {
    expect(readScan(itemUrl("https://envanter.app", "clx1234567"))).toEqual({
      kind: "item",
      itemId: "clx1234567",
    });
  });

  it("taban adres yokken basılan göreli yolu da okur", () => {
    expect(readScan(itemUrl(null, "clx1234567"))).toEqual({
      kind: "item",
      itemId: "clx1234567",
    });
  });

  it("sorgu ve çapa eklenmiş adresi okur", () => {
    expect(readScan("https://envanter.app/envanter/clx1234567?x=1#ek")).toEqual({
      kind: "item",
      itemId: "clx1234567",
    });
  });

  it("etiket sayfasının adresi de ürüne götürür", () => {
    expect(readScan("https://envanter.app/envanter/clx1234567/etiket")).toEqual({
      kind: "item",
      itemId: "clx1234567",
    });
  });

  it("büyük harfli şemayı kabul eder — bazı okuyucular böyle veriyor", () => {
    expect(readScan("HTTPS://ENVANTER.APP/envanter/clx1234567")).toEqual({
      kind: "item",
      itemId: "clx1234567",
    });
  });

  it("paylaşım bağlantısını tanır", () => {
    expect(readScan(shareUrl("https://envanter.app", TOKEN))).toEqual({
      kind: "share",
      token: TOKEN,
    });
  });

  it("bozuk paylaşım anahtarını tanımaz", () => {
    expect(readScan("https://envanter.app/p/kisa")).toEqual({
      kind: "unknown",
      text: "https://envanter.app/p/kisa",
    });
  });
});

describe("readScan — barkod", () => {
  it("düz metni aramaya düşürür", () => {
    expect(readScan("SN-99-ABC")).toEqual({ kind: "search", query: "SN-99-ABC" });
  });

  it("EAN barkodunu aramaya düşürür", () => {
    expect(readScan("8690637123456\n")).toEqual({
      kind: "search",
      query: "8690637123456",
    });
  });

  it("boş kodu yok sayar", () => {
    expect(readScan("   ")).toBeNull();
  });

  it("çok uzun metni aramaya sokmaz", () => {
    const uzun = "x".repeat(MAX_QUERY_LENGTH + 1);
    expect(readScan(uzun)).toEqual({ kind: "unknown", text: uzun });
  });
});

describe("readScan — yabancı kod", () => {
  it("başka sitenin adresini açmaz, tanınmadı der", () => {
    expect(readScan("https://baska.site/envanterim")).toEqual({
      kind: "unknown",
      text: "https://baska.site/envanterim",
    });
  });

  it("kendi alan adımız olsa bile bilinmeyen yolu açmaz", () => {
    expect(readScan("https://envanter.app/hesap")).toEqual({
      kind: "unknown",
      text: "https://envanter.app/hesap",
    });
  });

  it("wifi ve mailto gibi şemaları aramaya sokmaz", () => {
    expect(readScan("WIFI:S:Ev;T:WPA;P:1234;;")).toEqual({
      kind: "unknown",
      text: "WIFI:S:Ev;T:WPA;P:1234;;",
    });
    expect(readScan("mailto:engin@ornek.com")).toEqual({
      kind: "unknown",
      text: "mailto:engin@ornek.com",
    });
  });
});

describe("scanSummary", () => {
  it("her tür için Türkçe özet verir", () => {
    expect(scanSummary({ kind: "item", itemId: "i1" })).toBe("Envanterim etiketi");
    expect(scanSummary({ kind: "share", token: TOKEN })).toBe("Paylaşım bağlantısı");
    expect(scanSummary({ kind: "search", query: "SN-1" })).toBe("Kod: SN-1");
    expect(scanSummary({ kind: "unknown", text: "x" })).toBe("Tanınmayan kod");
  });
});
