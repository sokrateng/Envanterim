import { describe, expect, it } from "vitest";
import {
  extractedInvoiceSchema,
  priceToMinor,
  toFormValues,
  type ExtractedInvoice,
  type ExtractedItem,
} from "./invoice";

const invoice = (over: Partial<ExtractedInvoice> = {}): ExtractedInvoice => ({
  sellerName: "Teknosa",
  invoiceDate: "2026-03-14",
  currency: "TRY",
  items: [],
  note: null,
  ...over,
});

const item = (over: Partial<ExtractedItem> = {}): ExtractedItem => ({
  name: "Çamaşır makinesi",
  brand: "Bosch",
  model: "WGG24400TR",
  serialNo: null,
  unitPrice: 18400.5,
  warrantyMonths: 24,
  ...over,
});

describe("priceToMinor", () => {
  it("ondalık sayıyı kuruşa çevirir", () => {
    expect(priceToMinor(18400.5)).toBe(1840050);
    expect(priceToMinor(0.1 + 0.2)).toBe(30);
  });

  it("metni de kabul eder", () => {
    expect(priceToMinor("18.400,50")).toBe(1840050);
    expect(priceToMinor("saçma")).toBeNull();
  });

  it("null, eksi ve sonsuz için null", () => {
    expect(priceToMinor(null)).toBeNull();
    expect(priceToMinor(-5)).toBeNull();
    expect(priceToMinor(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("toFormValues", () => {
  it("kalemi forma çevirir ve garantiyi hesaplar", () => {
    expect(toFormValues(invoice(), item())).toEqual({
      name: "Çamaşır makinesi",
      brand: "Bosch",
      model: "WGG24400TR",
      serialNo: "",
      purchaseDate: "2026-03-14",
      warrantyEndDate: "2028-03-14",
      purchasePrice: "18.400,50",
      sellerName: "Teknosa",
      currency: "TRY",
      warrantyAssumed: false,
    });
  });

  it("faturadaki para birimini taşır, tanımadığını TRY'ye düşürür", () => {
    expect(toFormValues(invoice({ currency: "usd" }), item()).currency).toBe("USD");
    expect(toFormValues(invoice({ currency: "XAU" }), item()).currency).toBe("TRY");
    expect(toFormValues(invoice({ currency: null }), item()).currency).toBe("TRY");
  });

  it("garanti süresi faturada yoksa 24 ay varsayılıyor ve işaretleniyor", () => {
    // Boş bırakmak bedava değildi: garanti tarihi olmayan ekipman hatırlatma
    // da almıyor. Varsayım forma yazılıyor ama "varsayım" diye işaretli —
    // kullanıcı görüp değiştirebiliyor.
    const values = toFormValues(invoice(), item({ warrantyMonths: null }));
    expect(values.warrantyEndDate).toBe("2028-03-14");
    expect(values.warrantyAssumed).toBe(true);
  });

  it("faturada yazan süre varsayımın önüne geçiyor", () => {
    const values = toFormValues(invoice(), item({ warrantyMonths: 36 }));
    expect(values.warrantyEndDate).toBe("2029-03-14");
    expect(values.warrantyAssumed).toBe(false);
  });

  it("fatura tarihi okunamadıysa garanti hesaplanmaz", () => {
    const values = toFormValues(
      invoice({ invoiceDate: "bozuk" }),
      item({ warrantyMonths: 24 }),
    );
    expect(values.purchaseDate).toBe("");
    expect(values.warrantyEndDate).toBe("");
    expect(values.warrantyAssumed).toBe(false);
  });

  it("fiyat yoksa alan boş kalır — sıfır yazmaz", () => {
    expect(toFormValues(invoice(), item({ unitPrice: null })).purchasePrice).toBe("");
  });

  it("boşlukları kırpar", () => {
    const values = toFormValues(
      invoice({ sellerName: "  MediaMarkt " }),
      item({ name: " Buzdolabı ", brand: null }),
    );
    expect(values.name).toBe("Buzdolabı");
    expect(values.brand).toBe("");
    expect(values.sellerName).toBe("MediaMarkt");
  });
});

describe("extractedInvoiceSchema", () => {
  it("modelden dönebilecek eksiksiz yanıtı kabul eder", () => {
    const parsed = extractedInvoiceSchema.safeParse({
      sellerName: "Teknosa",
      invoiceDate: "2026-03-14",
      currency: "TRY",
      note: null,
      items: [
        {
          name: "Çamaşır makinesi",
          brand: "Bosch",
          model: "WGG24400TR",
          serialNo: null,
          unitPrice: 18400.5,
          warrantyMonths: 24,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("kalem listesi boş olabilir", () => {
    expect(
      extractedInvoiceSchema.safeParse({
        sellerName: null,
        invoiceDate: null,
        currency: null,
        note: "Fatura okunamadı",
        items: [],
      }).success,
    ).toBe(true);
  });

  it("eksik alanı reddeder — şekil garantisi buradan geliyor", () => {
    expect(
      extractedInvoiceSchema.safeParse({ sellerName: "Teknosa", items: [] }).success,
    ).toBe(false);
  });
});
