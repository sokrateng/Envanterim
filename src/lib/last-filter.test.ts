import { describe, expect, it } from "vitest";
import { filterQuery, inventoryHref } from "@/lib/last-filter";

describe("filterQuery", () => {
  it("yalnız süzme parametrelerini tutar", () => {
    expect(filterQuery("durum=IN_USE&kategori=abc&q=bosch")).toBe(
      "q=bosch&durum=IN_USE&kategori=abc",
    );
  });

  it("sayfa ve tek seferlik işaretleri atar", () => {
    // Sayfa numarası ikinci ziyarette başka satırlara denk geliyor; `yeni` ve
    // `seri` paneli açan tek seferlik işaretler.
    expect(filterQuery("durum=SOLD&sayfa=7&yeni=1&seri=SN-1")).toBe(
      "durum=SOLD",
    );
  });

  it("süzme yoksa boş dizgi verir", () => {
    // "Temizle" boş hâli saklıyor; boşluk da bir tercih.
    expect(filterQuery("")).toBe("");
    expect(filterQuery("sayfa=2")).toBe("");
  });
});

describe("inventoryHref", () => {
  it("saklanan süzmeyi adrese koyar", () => {
    expect(inventoryHref("durum=IN_USE,SOLD")).toBe(
      "/envanter?durum=IN_USE%2CSOLD",
    );
  });

  it("süzme yoksa düz adres", () => {
    expect(inventoryHref("")).toBe("/envanter");
  });

  it("panel işaretini süzmenin üstüne ekler", () => {
    expect(inventoryHref("lokasyon=ev1", { yeni: "1" })).toBe(
      "/envanter?lokasyon=ev1&yeni=1",
    );
  });
});
