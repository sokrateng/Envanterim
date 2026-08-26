import { XMLParser } from "fast-xml-parser";
import type { ExtractedInvoice, ExtractedItem } from "@/lib/invoice";

/**
 * e-Arşiv / e-Fatura (UBL-TR) ayrıştırıcısı — deterministik, modele gitmiyor.
 *
 * Türkiye'de elektronik ürün alışlarının çoğu e-Arşiv faturasıyla geliyor ve
 * veri zaten yapısal: XML varsa modele hiç gitme (docs/MIMARI.md §6). Sonuç
 * faturadan okumayla **aynı şekle** dönüyor, böylece onay ekranı ortak.
 */

const parser = new XMLParser({
  // cbc: / cac: önekleri atılıyor; UBL'de anlam öneke değil ada bağlı.
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

function asNode(value: unknown): Node | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Node)
    : null;
}

/** UBL'de tek kalem düğüm, çok kalem dizi olarak geliyor. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Metin ya da `{ "#text": ... }` biçimindeki değeri düz metne indirir. */
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  const node = asNode(value);
  if (node && "#text" in node) return text(node["#text"]);
  return null;
}

function number(value: unknown): number | null {
  const raw = text(value);
  if (raw === null) return null;
  // UBL tutarları nokta ondalıklı yazılır: 15333.75
  const parsed = Number(raw.replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function pick(node: Node | null, path: string[]): unknown {
  let current: unknown = node;
  for (const key of path) {
    const asObject = asNode(current);
    if (!asObject) return undefined;
    current = asObject[key];
  }
  return current;
}

export type EInvoiceLine = ExtractedItem & {
  /** Faturadaki miktar; birden çok aynı üründen alınmış olabilir. */
  quantity: number;
};

export type EInvoiceResult =
  | {
      ok: true;
      invoice: ExtractedInvoice & { invoiceNumber: string | null; lines: EInvoiceLine[] };
    }
  | { ok: false; message: string };

/** Miktar tam sayı ve makulse o kadar ekipman açılır; değilse tek kayıt. */
export function unitCount(quantity: number | null, max = 10): number {
  if (quantity === null || !Number.isFinite(quantity)) return 1;
  if (!Number.isInteger(quantity)) return 1;
  if (quantity < 1) return 1;
  return Math.min(quantity, max);
}

/** KDV dahil birim fiyat: (matrah + vergi) / miktar. */
export function unitPriceWithTax(
  lineAmount: number | null,
  taxAmount: number | null,
  quantity: number | null,
): number | null {
  if (lineAmount === null) return null;
  const count = quantity && quantity > 0 ? quantity : 1;
  const total = lineAmount + (taxAmount ?? 0);
  // Kuruşa yuvarla; kaydederken zaten kuruşa çevriliyor.
  return Math.round((total / count) * 100) / 100;
}

export function parseUblInvoice(xml: string): EInvoiceResult {
  let tree: unknown;
  try {
    tree = parser.parse(xml);
  } catch {
    return { ok: false, message: "XML okunamadı" };
  }

  const root = asNode(tree);
  const invoice = asNode(root?.Invoice);
  if (!invoice) {
    return {
      ok: false,
      message: "Bu dosya bir e-Fatura/e-Arşiv faturası değil (Invoice etiketi yok)",
    };
  }

  const sellerName =
    text(pick(invoice, ["AccountingSupplierParty", "Party", "PartyName", "Name"])) ??
    text(
      pick(invoice, [
        "AccountingSupplierParty",
        "Party",
        "PartyLegalEntity",
        "RegistrationName",
      ]),
    );

  const invoiceDate = text(invoice.IssueDate);
  const currency =
    text(invoice.DocumentCurrencyCode) ??
    text(pick(invoice, ["LegalMonetaryTotal", "PayableAmount", "@currencyID"])) ??
    "TRY";

  const rawLines = asArray(invoice.InvoiceLine);
  if (rawLines.length === 0) {
    return { ok: false, message: "Faturada kalem bulunamadı" };
  }

  const lines: EInvoiceLine[] = [];
  for (const raw of rawLines) {
    const line = asNode(raw);
    if (!line) continue;

    const item = asNode(line.Item);
    const name = text(pick(item, ["Name"]));
    if (!name) continue;

    const quantity = number(line.InvoicedQuantity);
    const lineAmount = number(line.LineExtensionAmount);
    const taxAmount = number(pick(line, ["TaxTotal", "TaxAmount"]));

    lines.push({
      name,
      brand: text(pick(item, ["BrandName"])),
      // Satıcı stok kodu genelde model kodu oluyor.
      model: text(pick(item, ["SellersItemIdentification", "ID"])),
      // Seri no faturada nadiren yazıyor; uydurmuyoruz.
      serialNo: null,
      unitPrice: unitPriceWithTax(lineAmount, taxAmount, quantity),
      warrantyMonths: null,
      quantity: quantity ?? 1,
    });
  }

  if (lines.length === 0) {
    return { ok: false, message: "Faturadaki kalemlerin adı okunamadı" };
  }

  return {
    ok: true,
    invoice: {
      sellerName,
      invoiceDate,
      currency,
      note: null,
      invoiceNumber: text(invoice.ID),
      items: lines,
      lines,
    },
  };
}
