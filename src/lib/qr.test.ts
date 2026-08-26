import { describe, expect, it } from "vitest";
import { itemUrl, labelLines, labelTitle, normalizeBaseUrl } from "./qr";

describe("normalizeBaseUrl", () => {
  it("sondaki eğik çizgiyi atar", () => {
    expect(normalizeBaseUrl("https://envanter.app/")).toBe("https://envanter.app");
    expect(normalizeBaseUrl("https://envanter.app///")).toBe("https://envanter.app");
  });

  it("şema yoksa https ekler", () => {
    expect(normalizeBaseUrl("envanter.app")).toBe("https://envanter.app");
  });

  it("http'yi korur — yerelde çalışırken gerekiyor", () => {
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("boş girdiye boş döner", () => {
    expect(normalizeBaseUrl(undefined)).toBe("");
    expect(normalizeBaseUrl("   ")).toBe("");
  });
});

describe("itemUrl", () => {
  it("ürün adresini kurar", () => {
    expect(itemUrl("https://envanter.app", "abc")).toBe(
      "https://envanter.app/envanter/abc",
    );
  });

  it("taban adres yoksa göreli yol döner", () => {
    expect(itemUrl("", "abc")).toBe("/envanter/abc");
  });
});

describe("labelLines", () => {
  it("marka ve modeli birleştirir", () => {
    expect(labelLines({ name: "x", brand: "Bosch", model: "WGG24400TR" })[0]).toEqual({
      label: "Marka",
      value: "Bosch WGG24400TR",
    });
  });

  it("boş alanları atlar", () => {
    expect(labelLines({ name: "x", brand: null, model: null, serialNo: null })).toEqual(
      [],
    );
  });

  it("en çok üç satır verir", () => {
    const lines = labelLines({
      name: "x",
      brand: "Bosch",
      model: "M1",
      serialNo: "SN1",
      locationName: "Ev",
    });
    expect(lines).toHaveLength(3);
  });

  it("yalnız model varsa da marka satırı çıkar", () => {
    expect(labelLines({ name: "x", model: "WGG" })[0].value).toBe("WGG");
  });
});

describe("labelTitle", () => {
  it("kısa adı olduğu gibi bırakır", () => {
    expect(labelTitle("Çamaşır makinesi")).toBe("Çamaşır makinesi");
  });

  it("uzun adı kırpar", () => {
    const title = labelTitle("Çok uzun bir ekipman adı yazdım buraya", 20);
    expect(title.length).toBeLessThanOrEqual(20);
    expect(title.endsWith("…")).toBe(true);
    expect(title).toBe("Çok uzun bir…");
  });

  it("boşluk çok erkense sert keser", () => {
    expect(labelTitle("A buzdolabımızınkiler", 12)).toBe("A buzdolabı…");
  });

  it("kırparken sondaki boşluğu atar", () => {
    expect(labelTitle("Buzdolabı beyaz eşya", 12)).toBe("Buzdolabı…");
  });
});
