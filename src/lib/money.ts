/**
 * Para her yerde kuruş cinsinden tamsayıdır (CLAUDE.md).
 * Float para yok: 0.1 + 0.2 sorununu envanter toplamlarına sokmayız.
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/**
 * "1.234,56" / "1,234.56" / "12.500" / "1234" → kuruş. Geçersizse null.
 *
 * Tek ayıraç varsa belirsizlik gerçek: "12.500" Türkçede on iki bin beş yüz,
 * İngilizcede on iki buçuk. Ayıraçtan sonra tam üç hane varsa binlik sayarız —
 * tr-TR girişinde doğru olan bu. İki farklı ayıraç varsa sondaki ondalıktır.
 */
export function parseMoney(input: string): number | null {
  const text = input.trim();
  if (text === "") return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  let decimalSep = "";
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const at = text.lastIndexOf(sep);
    const digitsAfter = text.length - at - 1;
    // "0,005" binlik olamaz: binlik grubunun başı sıfırla başlamaz.
    const head = text.slice(0, at).replace(/^-/, "");
    const groupsThousands = digitsAfter === 3 && head !== "" && !head.startsWith("0");
    decimalSep = groupsThousands ? "" : sep;
  }

  let normalized = text;
  if (decimalSep) {
    const thousandSep = decimalSep === "," ? "." : ",";
    normalized = normalized.split(thousandSep).join("");
    normalized = normalized.replace(decimalSep, ".");
  } else {
    normalized = normalized.split(".").join("").split(",").join("");
  }
  normalized = normalized.replace(/\s/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  // Yuvarlamayı yalnız kuruşa inerken yap; yarım kuruş yukarı gitsin.
  return Math.round(value * 100);
}

/** 123456 → "1.234,56" (simge yok). */
export function formatMinor(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const lira = Math.floor(abs / 100);
  const kurus = abs % 100;
  const liraText = lira.toLocaleString("tr-TR");
  return `${negative ? "-" : ""}${liraText},${String(kurus).padStart(2, "0")}`;
}

/** 123456, "TRY" → "1.234,56 ₺". */
export function formatMoney(minor: number, currency = "TRY"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${formatMinor(minor)} ${symbol}`;
}

/** Toplam — türetilmiş değer saklanmaz, hesaplanır (CLAUDE.md). */
export function sumMinor(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0);
}
