import { z } from "zod";
import { formatMinor, parseMoney } from "@/lib/money";

/**
 * Faturadan çıkarılan alanların şekli ve forma dönüşümü.
 *
 * Buradaki her şey saf: model çağrısı `invoice-extract.ts`'te. Çıkarılan veri
 * doğrudan kaydedilmez — forma doldurulur, kullanıcı görüp kaydeder
 * (CLAUDE.md, TUZAKLAR #36). Yapılandırılmış çıktı JSON'un *şeklini* garanti
 * eder, *doğruluğunu* değil.
 */

/** Modelden dönen alanlar. Emin olunamayan her alan null gelebilir. */
export const extractedItemSchema = z.object({
  name: z.string().describe("Ürünün adı, örn. 'Çamaşır makinesi'"),
  brand: z.string().nullable().describe("Marka, örn. 'Bosch'"),
  model: z.string().nullable().describe("Model kodu, örn. 'WGG24400TR'"),
  serialNo: z
    .string()
    .nullable()
    .describe("Seri numarası. Model kodu ile karıştırma; emin değilsen null"),
  unitPrice: z
    .number()
    .nullable()
    .describe("Bu kalemin KDV dahil birim fiyatı, ondalık sayı: 18400.50"),
  warrantyMonths: z
    .number()
    .int()
    .nullable()
    .describe("Faturada yazan garanti süresi (ay). Yazmıyorsa null"),
});

export const extractedInvoiceSchema = z.object({
  sellerName: z.string().nullable().describe("Satıcı firma adı"),
  invoiceDate: z
    .string()
    .nullable()
    .describe("Fatura tarihi, YYYY-MM-DD biçiminde"),
  currency: z
    .string()
    .nullable()
    .describe("Para birimi kodu: TRY, USD, EUR"),
  items: z
    .array(extractedItemSchema)
    .describe("Faturadaki ekipman kalemleri. Kargo, indirim gibi satırları alma"),
  note: z
    .string()
    .nullable()
    .describe("Okunamayan ya da şüpheli bir şey varsa tek cümle"),
});

/**
 * Modele giden şema. Ham JSON Schema tutuluyor çünkü SDK'nın zod yardımcısı
 * zod 4 bekliyor, uygulama zod 3 kullanıyor — iki zod sürümü taşımaktansa
 * şemayı burada yazıp dönen yanıtı yukarıdaki zod şemasıyla doğruluyoruz.
 * İkisi birlikte değişmeli.
 */
export const INVOICE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sellerName", "invoiceDate", "currency", "items", "note"],
  properties: {
    sellerName: {
      type: ["string", "null"],
      description: "Satıcı firma adı",
    },
    invoiceDate: {
      type: ["string", "null"],
      description: "Fatura tarihi, YYYY-MM-DD biçiminde",
    },
    currency: {
      type: ["string", "null"],
      description: "Para birimi kodu: TRY, USD, EUR",
    },
    note: {
      type: ["string", "null"],
      description: "Okunamayan ya da şüpheli bir şey varsa tek cümle",
    },
    items: {
      type: "array",
      description:
        "Faturadaki ekipman kalemleri. Kargo, montaj, indirim satırlarını alma",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "brand", "model", "serialNo", "unitPrice", "warrantyMonths"],
        properties: {
          name: { type: "string", description: "Ürünün adı" },
          brand: { type: ["string", "null"], description: "Marka" },
          model: { type: ["string", "null"], description: "Model kodu" },
          serialNo: {
            type: ["string", "null"],
            description:
              "Seri numarası. Model kodu ile karıştırma; emin değilsen null",
          },
          unitPrice: {
            type: ["number", "null"],
            description: "KDV dahil birim fiyat, ondalık sayı: 18400.50",
          },
          warrantyMonths: {
            type: ["integer", "null"],
            description: "Faturada yazan garanti süresi (ay); yazmıyorsa null",
          },
        },
      },
    },
  },
} as const;

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

/** Modelin verdiği ondalık fiyatı kuruşa çevirir. */
export function priceToMinor(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === "string") return parseMoney(value);
  if (!Number.isFinite(value) || value < 0) return null;
  // 18400.5 * 100 kayan noktada 1840050.0000000002 veriyor; yuvarla.
  return Math.round(value * 100);
}

/**
 * Ay ekler; ayın son gününü aşan tarihler o ayın sonuna çekilir.
 * 31 Ocak + 1 ay = 28/29 Şubat, "3 Mart" değil.
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/** "YYYY-MM-DD" metnini yerel günün başına çevirir; geçersizse null. */
export function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as unknown as [string, number, number, number];
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function toInputDate(date: Date | null): string {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Ekipman formunun beklediği alanlar (hepsi metin: forma doldurulacak). */
export type InvoiceFormValues = {
  name: string;
  brand: string;
  model: string;
  serialNo: string;
  purchaseDate: string;
  warrantyEndDate: string;
  purchasePrice: string;
  sellerName: string;
};

/**
 * Bir fatura kalemini forma dönüştürür. Garanti bitişi faturada ay olarak
 * verildiyse fatura tarihinden hesaplanır; ikisinden biri eksikse boş kalır —
 * uydurmuyoruz, kullanıcı görsün.
 */
export function toFormValues(
  invoice: ExtractedInvoice,
  item: ExtractedItem,
): InvoiceFormValues {
  const purchaseDate = parseDateOnly(invoice.invoiceDate);
  const minor = priceToMinor(item.unitPrice);

  const warrantyEnd =
    purchaseDate && item.warrantyMonths && item.warrantyMonths > 0
      ? addMonths(purchaseDate, item.warrantyMonths)
      : null;

  return {
    name: item.name.trim(),
    brand: item.brand?.trim() ?? "",
    model: item.model?.trim() ?? "",
    serialNo: item.serialNo?.trim() ?? "",
    purchaseDate: toInputDate(purchaseDate),
    warrantyEndDate: toInputDate(warrantyEnd),
    purchasePrice: minor === null ? "" : formatMinor(minor),
    sellerName: invoice.sellerName?.trim() ?? "",
  };
}
