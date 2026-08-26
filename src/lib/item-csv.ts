import { ITEM_STATUS, ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";
import { mapHeaders, normalizeHeader } from "@/lib/csv";
import { formatMinor, parseMoney } from "@/lib/money";

/**
 * Ekipman ↔ CSV dönüşümü — saf ve testli.
 *
 * Dışa aktarma insanın okuyacağı biçimde (tarih GG.AA.YYYY, tutar 18.400,50);
 * içe aktarma aynı biçimi geri okuyor, ayrıca ISO tarih ve düz sayı da kabul
 * ediyor — dosya Excel'de düzenlenip geri yüklenebilsin.
 */

export const CSV_COLUMNS = [
  "Ad",
  "Marka",
  "Model",
  "Seri no",
  "Kategori",
  "Yer",
  "Durum",
  "Satıcı",
  "Alış tarihi",
  "Alış tutarı",
  "Para birimi",
  "Garanti bitişi",
] as const;

/** Dışa aktarmada ek olarak yazılan, hesaplanmış sütunlar. */
export const DERIVED_COLUMNS = ["Sahip olma maliyeti"] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["Ad", "İsim", "Ekipman", "Ürün"],
  brand: ["Marka"],
  model: ["Model"],
  serialNo: ["Seri no", "Serino", "Seri numarası"],
  categoryName: ["Kategori"],
  place: ["Yer", "Konum", "Oda"],
  statusLabel: ["Durum"],
  sellerName: ["Satıcı", "Satici", "Firma"],
  purchaseDate: ["Alış tarihi", "Alis tarihi", "Satın alma tarihi"],
  purchasePrice: ["Alış tutarı", "Tutar", "Fiyat"],
  currency: ["Para birimi", "Kur"],
  warrantyEndDate: ["Garanti bitişi", "Garanti bitiş", "Garanti"],
};

export type ExportItem = {
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  categoryName: string | null;
  place: string | null;
  status: string;
  sellerName: string | null;
  purchaseDate: Date | null;
  purchasePriceMinor: number | null;
  currency: string;
  warrantyEndDate: Date | null;
  ownershipCostMinor: number;
};

const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(date: Date | null): string {
  return date ? trDate.format(date) : "";
}

export function itemToRow(item: ExportItem): Record<string, string> {
  return {
    Ad: item.name,
    Marka: item.brand ?? "",
    Model: item.model ?? "",
    "Seri no": item.serialNo ?? "",
    Kategori: item.categoryName ?? "",
    Yer: item.place ?? "",
    Durum: ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status,
    Satıcı: item.sellerName ?? "",
    "Alış tarihi": formatDate(item.purchaseDate),
    "Alış tutarı":
      item.purchasePriceMinor == null ? "" : formatMinor(item.purchasePriceMinor),
    "Para birimi": item.currency,
    "Garanti bitişi": formatDate(item.warrantyEndDate),
    "Sahip olma maliyeti": formatMinor(item.ownershipCostMinor),
  };
}

/** "14.03.2026", "2026-03-14" ve "14/03/2026" kabul edilir. */
export function parseFlexibleDate(input: string): Date | null {
  const text = input.trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);

  let year: number;
  let month: number;
  let day: number;

  if (iso) {
    [, year, month, day] = iso.map(Number) as unknown as [string, number, number, number];
  } else if (tr) {
    const [, d, m, y] = tr.map(Number) as unknown as [string, number, number, number];
    year = y;
    month = m;
    day = d;
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Durum sütunu Türkçe etiketle ya da kodla yazılmış olabilir. */
export function parseStatus(input: string): ItemStatus | null {
  const text = input.trim();
  if (!text) return "IN_USE";

  const asCode = ITEM_STATUS.find((status) => status === text.toUpperCase());
  if (asCode) return asCode;

  const wanted = normalizeHeader(text);
  const entry = Object.entries(ITEM_STATUS_LABELS).find(
    ([, label]) => normalizeHeader(label) === wanted,
  );
  return entry ? (entry[0] as ItemStatus) : null;
}

export type ImportRow = {
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  categoryName: string | null;
  place: string | null;
  status: ItemStatus;
  sellerName: string | null;
  purchaseDate: Date | null;
  purchasePriceMinor: number | null;
  currency: string;
  warrantyEndDate: Date | null;
};

export type RowResult =
  | { ok: true; row: ImportRow }
  | { ok: false; errors: string[] };

export function buildMapping(headers: string[]): Record<string, string> {
  return mapHeaders(headers, HEADER_ALIASES);
}

/** Zorunlu sütun yoksa dosya hiç işlenmesin. */
export function missingRequired(mapping: Record<string, string>): string[] {
  return mapping.name ? [] : ["Ad"];
}

export function parseImportRow(
  raw: Record<string, string>,
  mapping: Record<string, string>,
): RowResult {
  const value = (field: string) => (mapping[field] ? (raw[mapping[field]] ?? "").trim() : "");
  const orNull = (field: string) => value(field) || null;
  const errors: string[] = [];

  const name = value("name");
  if (!name) errors.push("Ad boş");

  const status = parseStatus(value("statusLabel"));
  if (status === null) errors.push(`Durum tanınmadı: ${value("statusLabel")}`);

  const purchaseDateText = value("purchaseDate");
  const purchaseDate = parseFlexibleDate(purchaseDateText);
  if (purchaseDateText && !purchaseDate) {
    errors.push(`Alış tarihi okunamadı: ${purchaseDateText}`);
  }

  const warrantyText = value("warrantyEndDate");
  const warrantyEndDate = parseFlexibleDate(warrantyText);
  if (warrantyText && !warrantyEndDate) {
    errors.push(`Garanti bitişi okunamadı: ${warrantyText}`);
  }

  const priceText = value("purchasePrice");
  const purchasePriceMinor = priceText ? parseMoney(priceText) : null;
  if (priceText && purchasePriceMinor === null) {
    errors.push(`Alış tutarı okunamadı: ${priceText}`);
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    row: {
      name,
      brand: orNull("brand"),
      model: orNull("model"),
      serialNo: orNull("serialNo"),
      categoryName: orNull("categoryName"),
      place: orNull("place"),
      status: status as ItemStatus,
      sellerName: orNull("sellerName"),
      purchaseDate,
      purchasePriceMinor,
      // Para birimi yazılmadıysa lokasyonun varsayılanı kullanılır.
      currency: (value("currency") || "TRY").toUpperCase().slice(0, 3),
      warrantyEndDate,
    },
  };
}

export type ImportPreview = {
  ready: ImportRow[];
  failed: Array<{ line: number; errors: string[] }>;
};

/** Tüm dosyayı işler; hatalı satır tüm aktarmayı durdurmaz, listelenir. */
export function parseImportRows(
  rows: Array<Record<string, string>>,
  mapping: Record<string, string>,
): ImportPreview {
  const ready: ImportRow[] = [];
  const failed: ImportPreview["failed"] = [];

  rows.forEach((raw, index) => {
    const result = parseImportRow(raw, mapping);
    // Başlık 1. satır; kullanıcı dosyada bu numarayı görüyor.
    if (result.ok) ready.push(result.row);
    else failed.push({ line: index + 2, errors: result.errors });
  });

  return { ready, failed };
}
