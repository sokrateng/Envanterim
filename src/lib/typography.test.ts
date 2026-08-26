import { describe, expect, it } from "vitest";
import { titleClass } from "@/lib/typography";

describe("titleClass", () => {
  it("kısa adı en büyük puntoda bırakır", () => {
    expect(titleClass("Buzdolabı")).toContain("text-large-title");
    expect(titleClass("Klima")).toContain("text-large-title");
  });

  it("ad uzadıkça puntoyu küçültür", () => {
    expect(titleClass("Çamaşır makinesi")).toContain("text-large-title");
    expect(titleClass("Kombi Vaillant 24kW")).toContain("text-title");
    expect(titleClass("Bosch Serie 6 çamaşır makinesi")).toContain("text-headline");
    expect(titleClass("A".repeat(6) + " " + "B".repeat(6) + " " + "C".repeat(60))).toContain(
      "text-subheadline",
    );
  });

  it("uzun tek sözcük puntoyu küçültür: sözcük bölünmüyor", () => {
    // Toplam kısa ama sözcük 34px'te satıra sığmıyor.
    expect(titleClass("SN1787787457903")).toContain("text-title");
    // Aynı uzunluk sözcüklere bölününce en büyük punto sığıyor.
    expect(titleClass("SN 178 778 745")).toContain("text-large-title");
  });

  it("her adımda satır kırpması var: sabit alan taşmasın", () => {
    for (const ad of ["Kısa", "A".repeat(35), "A".repeat(60), "A".repeat(300)]) {
      expect(titleClass(ad)).toMatch(/line-clamp-\d/);
    }
  });

  it("baştaki sondaki boşluğu saymaz", () => {
    expect(titleClass("   Buzdolabı   ")).toBe(titleClass("Buzdolabı"));
  });
});
