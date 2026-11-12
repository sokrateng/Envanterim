import { describe, expect, it } from "vitest";
import { foldTurkish, sameText } from "./text-match";

describe("sameText", () => {
  it("büyük/küçük harfi yok sayar", () => {
    expect(sameText("Arçelik Servis", "arçelik servis")).toBe(true);
  });

  it("I, ı, İ ve i'yi aynı sayar (barkod ve firma adı için)", () => {
    expect(sameText("SN-I22", "sn-i22")).toBe(true);
    expect(sameText("İstanbul Teknik", "istanbul teknik")).toBe(true);
    expect(sameText("ISPARTA", "ısparta")).toBe(true);
    expect(sameText("Ilgaz", "ilgaz")).toBe(true);
  });

  it("baştaki ve sondaki boşluğu yok sayar", () => {
    expect(sameText("  Vestel ", "vestel")).toBe(true);
  });

  it("Türkçe harfleri ASCII karşılığıyla eşitlemez", () => {
    expect(sameText("Cay", "Çay")).toBe(false);
    expect(sameText("Sise", "Şişe")).toBe(false);
  });
});

describe("foldTurkish", () => {
  it("noktalı büyük İ'yi i yapar", () => {
    expect(foldTurkish("İ")).toBe("i");
  });
});
