import { z } from "zod";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/constants";
import { addMonths, parseDateOnly, toInputDate } from "@/lib/dates";
import { DEFAULT_WARRANTY_MONTHS } from "@/lib/warranty";
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
  /** Faturada yazan para birimi; tanımadığımız bir kod gelirse TRY. */
  currency: string;
  /**
   * Garanti bitişi faturadan mı okundu, yoksa 24 ay varsayımı mı. Form bunu
   * kullanıcıya söylüyor: varsayım, okunan bilgi kadar güvenilir değil.
   */
  warrantyAssumed: boolean;
};

/**
 * Bir fatura kalemini forma dönüştürür.
 *
 * Garanti bitişi faturada ay olarak yazıyorsa ondan, yazmıyorsa 24 ay
 * varsayımıyla hesaplanır (`DEFAULT_WARRANTY_MONTHS`) — ekipman formundaki
 * öneriyle aynı kural. Fatura tarihi yoksa boş kalıyor: neye ekleyeceğimiz
 * belli değil.
 *
 * Varsayım uydurmak değil çünkü kullanıcıya sorulan bir alana yazılıyor:
 * `warrantyAssumed` ile işaretleniyor, form da "önerildi; değiştirebilirsin"
 * diyor. Boş bırakmak da bedava değildi — garanti tarihi olmayan ekipman
 * hatırlatma da almıyor.
 */
export function toFormValues(
  invoice: ExtractedInvoice,
  item: ExtractedItem,
): InvoiceFormValues {
  const purchaseDate = parseDateOnly(invoice.invoiceDate);
  const minor = priceToMinor(item.unitPrice);

  const faturadakiAy =
    item.warrantyMonths && item.warrantyMonths > 0 ? item.warrantyMonths : null;
  const warrantyEnd = purchaseDate
    ? addMonths(purchaseDate, faturadakiAy ?? DEFAULT_WARRANTY_MONTHS)
    : null;

  const currency = (invoice.currency ?? "").trim().toUpperCase();

  return {
    name: item.name.trim(),
    brand: item.brand?.trim() ?? "",
    model: item.model?.trim() ?? "",
    serialNo: item.serialNo?.trim() ?? "",
    purchaseDate: toInputDate(purchaseDate),
    warrantyEndDate: toInputDate(warrantyEnd),
    purchasePrice: minor === null ? "" : formatMinor(minor),
    sellerName: invoice.sellerName?.trim() ?? "",
    currency: (CURRENCIES as readonly string[]).includes(currency)
      ? currency
      : DEFAULT_CURRENCY,
    warrantyAssumed: warrantyEnd !== null && faturadakiAy === null,
  };
}
