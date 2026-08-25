import { describe, expect, it } from "vitest";
import { formatMinor, formatMoney, parseMoney, sumMinor } from "./money";

describe("parseMoney", () => {
  it("Türkçe biçimi okur", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("0,05")).toBe(5);
    expect(parseMoney("1.234.567,89")).toBe(123456789);
  });

  it("İngilizce biçimi okur", () => {
    expect(parseMoney("1,234.56")).toBe(123456);
    expect(parseMoney("1234.5")).toBe(123450);
  });

  it("ayıraçsız tam sayıyı okur", () => {
    expect(parseMoney("1500")).toBe(150000);
    expect(parseMoney(" 42 ")).toBe(4200);
  });

  it("üç haneli tek grubu binlik sayar", () => {
    expect(parseMoney("12.500")).toBe(1250000);
    expect(parseMoney("1,005")).toBe(100500);
    expect(parseMoney("0,005")).toBe(1); // sıfırla başlayan grup binlik olamaz
  });

  it("kuruş altını yuvarlar", () => {
    expect(parseMoney("0,005")).toBe(1);
    expect(parseMoney("0,004")).toBe(0);
    expect(parseMoney("10,5551")).toBe(1056);
  });

  it("geçersiz girdiye null döner", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.2.3,4,5")).toBeNull();
    expect(parseMoney("12₺")).toBeNull();
  });
});

describe("formatMinor / formatMoney", () => {
  it("kuruşu iki hane yazar", () => {
    expect(formatMinor(5)).toBe("0,05");
    expect(formatMinor(100)).toBe("1,00");
    expect(formatMinor(123456)).toBe("1.234,56");
  });

  it("eksi tutarı korur", () => {
    expect(formatMinor(-2550)).toBe("-25,50");
  });

  it("simge ekler", () => {
    expect(formatMoney(123456)).toBe("1.234,56 ₺");
    expect(formatMoney(100, "USD")).toBe("1,00 $");
    expect(formatMoney(100, "GBP")).toBe("1,00 GBP");
  });

  it("gidiş-dönüş bozulmaz", () => {
    const minor = parseMoney("18.400,00");
    expect(minor).not.toBeNull();
    expect(formatMoney(minor!)).toBe("18.400,00 ₺");
  });
});

describe("sumMinor", () => {
  it("boş ve tanımsız değerleri atlar", () => {
    expect(sumMinor([100, null, 250, undefined])).toBe(350);
    expect(sumMinor([])).toBe(0);
  });
});
