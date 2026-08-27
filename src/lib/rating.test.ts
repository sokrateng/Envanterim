import { describe, expect, it } from "vitest";
import {
  averageStars,
  filledStars,
  formatStars,
  isValidStars,
  ratingSummary,
} from "@/lib/rating";

describe("isValidStars", () => {
  it("1-5 arası tam sayı kabul eder", () => {
    expect(isValidStars(1)).toBe(true);
    expect(isValidStars(5)).toBe(true);
    expect(isValidStars(0)).toBe(false);
    expect(isValidStars(6)).toBe(false);
    expect(isValidStars(3.5)).toBe(false);
    expect(isValidStars("4")).toBe(false);
    expect(isValidStars(null)).toBe(false);
  });
});

describe("averageStars", () => {
  it("puan yoksa null verir: sıfır yıldız değil", () => {
    expect(averageStars([])).toBeNull();
  });

  it("tek ondalığa yuvarlar", () => {
    expect(averageStars([5, 4, 4])).toBe(4.3);
    expect(averageStars([5, 5])).toBe(5);
  });

  it("geçersiz puanları saymaz", () => {
    expect(averageStars([5, 0, 9, 3])).toBe(4);
  });
});

describe("formatStars", () => {
  it("virgül kullanır, tam sayıyı ondalıksız yazar", () => {
    expect(formatStars(4.3)).toBe("4,3");
    expect(formatStars(5)).toBe("5");
    expect(formatStars(null)).toBe("—");
  });
});

describe("filledStars", () => {
  it("en yakın tama yuvarlar ve sınırları aşmaz", () => {
    expect(filledStars(4.3)).toBe(4);
    expect(filledStars(4.6)).toBe(5);
    expect(filledStars(null)).toBe(0);
    expect(filledStars(9)).toBe(5);
    expect(filledStars(-2)).toBe(0);
  });
});

describe("ratingSummary", () => {
  it("puan yoksa bunu söyler", () => {
    expect(ratingSummary(0, null)).toBe("Henüz puan yok");
  });

  it("kişi sayısını ve ortalamayı verir", () => {
    expect(ratingSummary(3, 4.3)).toBe("3 kişi · ortalama 4,3");
  });
});
