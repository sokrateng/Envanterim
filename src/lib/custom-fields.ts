import { z } from "zod";
import type { FieldType } from "@/lib/constants";

/**
 * Dinamik alanlar `Item.customFields` (JSONB) içinde durur; tip güvenliğini
 * veritabanı vermez (MIMARI §3). Doğrulama burada: `CategoryField`
 * tanımlarından çalışma anında Zod şeması üretilir ve yazma bu şemadan geçer.
 * Bu adım atlanırsa bozuk veri girer (CLAUDE.md, TUZAKLAR #25).
 */

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[] | null;
  hidden?: boolean;
};

export type CustomFieldValues = Record<string, string | number | boolean>;

const emptyish = (value: unknown) =>
  value === undefined || value === null || value === "";

function fieldSchema(field: FieldDef): z.ZodTypeAny {
  const required = field.required;
  const missing = `${field.label} gerekli`;

  switch (field.type) {
    case "NUMBER":
      return z.preprocess((v) => {
        if (emptyish(v)) return undefined;
        if (typeof v === "number") return v;
        // Form metni: "1.234,5" gibi Türkçe ondalık da kabul edilir.
        const text = String(v).trim().replace(/\./g, "").replace(",", ".");
        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : text;
      }, required ? z.number({ invalid_type_error: `${field.label} sayı olmalı`, required_error: missing }) : z.number({ invalid_type_error: `${field.label} sayı olmalı` }).optional());

    case "BOOL":
      return z.preprocess((v) => {
        if (emptyish(v)) return required ? undefined : false;
        if (typeof v === "boolean") return v;
        const text = String(v).toLowerCase();
        if (["true", "on", "evet", "1"].includes(text)) return true;
        if (["false", "off", "hayır", "hayir", "0"].includes(text)) return false;
        return v;
      }, required
        ? z.boolean({ invalid_type_error: `${field.label} evet/hayır olmalı`, required_error: missing })
        : z.boolean({ invalid_type_error: `${field.label} evet/hayır olmalı` }).optional());

    case "DATE": {
      // JSON'da tarih tipi yok; "YYYY-MM-DD" metni saklanır ve okurken
      // günün başına normalize edilir (TUZAKLAR #27).
      const date = z
        .string({ required_error: missing })
        .regex(/^\d{4}-\d{2}-\d{2}$/, `${field.label} tarih olmalı`)
        .refine((value) => {
          const [y, m, d] = value.split("-").map(Number);
          const parsed = new Date(y, m - 1, d);
          return (
            parsed.getFullYear() === y &&
            parsed.getMonth() === m - 1 &&
            parsed.getDate() === d
          );
        }, `${field.label} geçersiz tarih`);
      return required
        ? z.preprocess((v) => (emptyish(v) ? undefined : v), date)
        : z.preprocess((v) => (emptyish(v) ? undefined : v), date.optional());
    }

    case "SELECT": {
      const options = (field.options ?? []).filter(
        (option): option is string => typeof option === "string" && option !== "",
      );
      // Seçeneksiz SELECT tanımı bozuk; hiçbir değeri kabul etmemek yerine
      // alanı serbest metne düşürmek sessiz veri kaybı olurdu.
      const base = options.length
        ? z.enum(options as [string, ...string[]], {
            errorMap: () => ({ message: `${field.label} için geçersiz seçenek` }),
          })
        : z.never({ invalid_type_error: `${field.label} için seçenek tanımlı değil` });
      return required
        ? z.preprocess((v) => (emptyish(v) ? undefined : v), base)
        : z.preprocess((v) => (emptyish(v) ? undefined : v), base.optional());
    }

    case "TEXT":
    default: {
      const text = z
        .string({ required_error: missing, invalid_type_error: `${field.label} metin olmalı` })
        .trim()
        .max(500, `${field.label} en çok 500 karakter`);
      return required
        ? z.preprocess((v) => (emptyish(v) ? undefined : v), text.min(1, missing))
        : z.preprocess((v) => (emptyish(v) ? undefined : v), text.optional());
    }
  }
}

/** Gizli alan doğrulanmaz: tanımı gizlenmiş alanın değeri korunur (TUZAKLAR #26). */
export function visibleFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((field) => !field.hidden);
}

export function buildCustomFieldsSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of visibleFields(fields)) {
    shape[field.key] = fieldSchema(field);
  }
  // Tanımsız anahtarlar sessizce düşürülür; birleştirme mergeCustomFields'ta.
  return z.object(shape).strip();
}

/**
 * Kaydedilecek JSONB gövdesi. Tanımı gizlenmiş ya da silinmiş alanların eski
 * değerleri korunur; görünür alanların boş gelenleri silinir.
 */
export function mergeCustomFields(
  existing: unknown,
  validated: Record<string, unknown>,
  fields: FieldDef[],
): CustomFieldValues {
  const previous: Record<string, unknown> =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  for (const field of visibleFields(fields)) {
    const value = validated[field.key];
    if (value === undefined) delete previous[field.key];
    else previous[field.key] = value;
  }

  return previous as CustomFieldValues;
}

/** Okuma tarafı: eksik ve fazla anahtara dayanıklı (TUZAKLAR #25). */
export function readCustomFields(
  stored: unknown,
  fields: FieldDef[],
): Array<{ key: string; label: string; text: string }> {
  const values: Record<string, unknown> =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  return visibleFields(fields)
    .map((field) => ({
      key: field.key,
      label: field.label,
      text: displayValue(values[field.key], field),
    }))
    .filter((row) => row.text !== "");
}

function displayValue(value: unknown, field: FieldDef): string {
  if (emptyish(value)) return "";
  if (field.type === "BOOL") return value ? "Evet" : "Hayır";
  if (field.type === "DATE" && typeof value === "string") {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return String(value);
    return new Intl.DateTimeFormat("tr-TR").format(new Date(y, m - 1, d));
  }
  if (typeof value === "number") return value.toLocaleString("tr-TR");
  return String(value);
}

/** Alan anahtarı etiketten üretilir; Türkçe harfler ASCII'ye indirilir. */
export function keyFromLabel(label: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return label
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
