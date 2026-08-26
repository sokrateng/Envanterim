import { describe, expect, it } from "vitest";
import { toCsv, toTable } from "./csv";
import {
  CSV_COLUMNS,
  DERIVED_COLUMNS,
  buildMapping,
  itemToRow,
  missingRequired,
  parseFlexibleDate,
  parseImportRow,
  parseImportRows,
  parseStatus,
  type ExportItem,
} from "./item-csv";

const item = (over: Partial<ExportItem> = {}): ExportItem => ({
  name: "Çamaşır makinesi",
  brand: "Bosch",
  model: "WGG24400TR",
  serialNo: "SN-1",
  categoryName: "Beyaz eşya",
  place: "Banyo",
  status: "IN_USE",
  sellerName: "Teknosa",
  purchaseDate: new Date(2026, 2, 14),
  purchasePriceMinor: 1840050,
  currency: "TRY",
  warrantyEndDate: new Date(2028, 2, 14),
  ownershipCostMinor: 2025050,
  ...over,
});

describe("itemToRow", () => {
  it("insanın okuyacağı biçimde yazar", () => {
    const row = itemToRow(item());
    expect(row["Alış tarihi"]).toBe("14.03.2026");
    expect(row["Alış tutarı"]).toBe("18.400,50");
    expect(row.Durum).toBe("Kullanımda");
    expect(row["Sahip olma maliyeti"]).toBe("20.250,50");
  });

  it("boş alanları boş bırakır", () => {
    const row = itemToRow(
      item({ brand: null, purchaseDate: null, purchasePriceMinor: null }),
    );
    expect(row.Marka).toBe("");
    expect(row["Alış tarihi"]).toBe("");
    expect(row["Alış tutarı"]).toBe("");
  });
});

describe("parseFlexibleDate", () => {
  it("Türkçe ve ISO biçimi okur", () => {
    expect(parseFlexibleDate("14.03.2026")?.getMonth()).toBe(2);
    expect(parseFlexibleDate("2026-03-14")?.getDate()).toBe(14);
    expect(parseFlexibleDate("14/03/2026")?.getFullYear()).toBe(2026);
  });

  it("olmayan günü reddeder", () => {
    expect(parseFlexibleDate("31.02.2026")).toBeNull();
    expect(parseFlexibleDate("2026-02-31")).toBeNull();
  });

  it("boş metne null", () => {
    expect(parseFlexibleDate("   ")).toBeNull();
    expect(parseFlexibleDate("yakında")).toBeNull();
  });
});

describe("parseStatus", () => {
  it("Türkçe etiketi tanır", () => {
    expect(parseStatus("Kullanımda")).toBe("IN_USE");
    expect(parseStatus("serviste")).toBe("IN_REPAIR");
    expect(parseStatus("SATILDI")).toBe("SOLD");
  });

  it("kodu da kabul eder", () => {
    expect(parseStatus("RETIRED")).toBe("RETIRED");
  });

  it("boşsa kullanımda sayar", () => {
    expect(parseStatus("")).toBe("IN_USE");
  });

  it("tanımadığına null döner", () => {
    expect(parseStatus("bozuk")).toBeNull();
  });
});

describe("buildMapping / missingRequired", () => {
  it("Türkçe başlıkları eşler", () => {
    const mapping = buildMapping([...CSV_COLUMNS]);
    expect(mapping.name).toBe("Ad");
    expect(mapping.serialNo).toBe("Seri no");
    expect(mapping.warrantyEndDate).toBe("Garanti bitişi");
  });

  it("farklı yazımları da eşler", () => {
    const mapping = buildMapping(["ÜRÜN", "seri numarası", "satın alma tarihi"]);
    expect(mapping.name).toBe("ÜRÜN");
    expect(mapping.serialNo).toBe("seri numarası");
    expect(mapping.purchaseDate).toBe("satın alma tarihi");
  });

  it("ad sütunu yoksa söyler", () => {
    expect(missingRequired(buildMapping(["Marka"]))).toEqual(["Ad"]);
    expect(missingRequired(buildMapping(["Ad"]))).toEqual([]);
  });
});

describe("parseImportRow", () => {
  const mapping = buildMapping([...CSV_COLUMNS]);

  it("dolu satırı okur", () => {
    const result = parseImportRow(itemToRow(item()), mapping);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.name).toBe("Çamaşır makinesi");
      expect(result.row.purchasePriceMinor).toBe(1840050);
      expect(result.row.purchaseDate?.getDate()).toBe(14);
      expect(result.row.status).toBe("IN_USE");
    }
  });

  it("adı boş satırı reddeder", () => {
    const result = parseImportRow({ Ad: "  " }, mapping);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Ad boş");
  });

  it("bozuk tarih ve tutarı tek tek bildirir", () => {
    const result = parseImportRow(
      { Ad: "X", "Alış tarihi": "dün", "Alış tutarı": "bedava" },
      mapping,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it("para birimi yoksa TRY sayar", () => {
    const result = parseImportRow({ Ad: "X" }, mapping);
    expect(result.ok && result.row.currency).toBe("TRY");
  });

  it("eşleşmeyen sütunları yok sayar", () => {
    const result = parseImportRow({ Ad: "X", Bilinmeyen: "y" }, mapping);
    expect(result.ok).toBe(true);
  });
});

describe("parseImportRows", () => {
  const mapping = buildMapping([...CSV_COLUMNS]);

  it("hatalı satır diğerlerini durdurmaz", () => {
    const preview = parseImportRows(
      [{ Ad: "İyi" }, { Ad: "" }, { Ad: "Yine iyi" }],
      mapping,
    );
    expect(preview.ready).toHaveLength(2);
    expect(preview.failed).toEqual([{ line: 3, errors: ["Ad boş"] }]);
  });

  it("satır numarası dosyadaki numarayla aynı", () => {
    const preview = parseImportRows([{ Ad: "" }], mapping);
    // Başlık 1. satır, ilk veri satırı 2.
    expect(preview.failed[0].line).toBe(2);
  });
});

describe("dışa aktar → içe aktar gidiş dönüşü", () => {
  it("yazılan dosya geri okunduğunda aynı veriyi veriyor", () => {
    const original = item({ name: 'Ekran 12"; büyük', place: "Salon" });
    const csv = toCsv([itemToRow(original)], [...CSV_COLUMNS, ...DERIVED_COLUMNS]);

    const table = toTable(csv);
    const preview = parseImportRows(table.rows, buildMapping(table.headers));

    expect(preview.failed).toEqual([]);
    const row = preview.ready[0];
    expect(row.name).toBe('Ekran 12"; büyük');
    expect(row.brand).toBe("Bosch");
    expect(row.serialNo).toBe("SN-1");
    expect(row.categoryName).toBe("Beyaz eşya");
    expect(row.place).toBe("Salon");
    expect(row.status).toBe("IN_USE");
    expect(row.sellerName).toBe("Teknosa");
    expect(row.purchasePriceMinor).toBe(original.purchasePriceMinor);
    expect(row.purchaseDate?.getTime()).toBe(original.purchaseDate?.getTime());
    expect(row.warrantyEndDate?.getTime()).toBe(original.warrantyEndDate?.getTime());
  });
});
