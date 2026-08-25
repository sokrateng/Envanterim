import { z } from "zod";
import { FIELD_TYPES, ITEM_STATUS, ROLES } from "@/lib/constants";
import { parseMoney } from "@/lib/money";
import { normalizeInviteCode } from "@/lib/invite";

// Her API ucunun gövdesi buradan geçer; hata mesajları Türkçe (CLAUDE.md).

const trimmed = z.string().trim();

/** "2026-03-14" → yerel günün başı. Saat dilimi kayması TUZAKLAR #27. */
export const dateOnly = trimmed
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih GG.AA.YYYY biçiminde olmalı")
  .transform((value, ctx) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== m - 1 ||
      date.getDate() !== d
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Geçersiz tarih" });
      return z.NEVER;
    }
    return date;
  });

/** Form metnini kuruşa çevirir. Boş alan null. */
export const moneyMinor = trimmed.transform((value, ctx) => {
  if (value === "") return null;
  const minor = parseMoney(value);
  if (minor === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tutar sayı olmalı" });
    return z.NEVER;
  }
  if (minor < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tutar eksi olamaz" });
    return z.NEVER;
  }
  return minor;
});

const optionalText = trimmed.max(200, "En çok 200 karakter").optional();
/**
 * Formdan boş alan "" gelir; şemaya girmeden undefined'a çevrilir.
 * Dönüş tipi açıkça yazılıyor: z.preprocess girdi tipini unknown'a düşürüyor
 * ve çıktı tipi Prisma'ya giderken kayboluyor.
 */
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    schema.optional(),
  ) as unknown as z.ZodType<z.output<T> | undefined, z.ZodTypeDef, unknown>;

export const loginSchema = z.object({
  username: trimmed.min(1, "Kullanıcı adı gerekli"),
  password: z.string().min(1, "Şifre gerekli"),
});

export const usernameSchema = trimmed
  .min(3, "Kullanıcı adı en az 3 karakter")
  .max(32, "Kullanıcı adı en çok 32 karakter")
  .regex(/^[a-z0-9._-]+$/i, "Yalnız harf, rakam, nokta, tire ve alt çizgi")
  .transform((v) => v.toLowerCase());

export const locationCreateSchema = z.object({
  name: trimmed.min(1, "Lokasyon adı gerekli").max(60, "En çok 60 karakter"),
  icon: emptyToUndefined(trimmed.max(8)),
});

export const memberInviteSchema = z.object({
  username: usernameSchema,
  role: z.enum(ROLES, { errorMap: () => ({ message: "Geçersiz rol" }) }),
});

export const memberUpdateSchema = z.object({
  role: z.enum(ROLES, { errorMap: () => ({ message: "Geçersiz rol" }) }),
});

export const inviteCreateSchema = z.object({
  role: z.enum(ROLES, { errorMap: () => ({ message: "Geçersiz rol" }) }),
});

export const registerSchema = z.object({
  code: trimmed
    .min(1, "Davet kodu gerekli")
    .transform((value) => normalizeInviteCode(value)),
  name: trimmed.min(1, "Ad gerekli").max(60, "En çok 60 karakter"),
  username: usernameSchema,
  password: z.string().min(8, "Şifre en az 8 karakter"),
});

export const itemCreateSchema = z.object({
  name: trimmed.min(1, "Ekipman adı gerekli").max(120, "En çok 120 karakter"),
  brand: emptyToUndefined(optionalText),
  model: emptyToUndefined(optionalText),
  serialNo: emptyToUndefined(optionalText),
  place: emptyToUndefined(optionalText),
  purchaseDate: emptyToUndefined(dateOnly),
  purchasePrice: emptyToUndefined(moneyMinor),
  warrantyEndDate: emptyToUndefined(dateOnly),
  status: z
    .enum(ITEM_STATUS, { errorMap: () => ({ message: "Geçersiz durum" }) })
    .default("IN_USE"),
  categoryId: emptyToUndefined(trimmed),
  // Dinamik alanlar burada ham gelir; asıl doğrulama kategori tanımlarından
  // üretilen şemayla yapılır (src/lib/custom-fields.ts).
  customFields: z.record(z.unknown()).default({}),
});

export const itemUpdateSchema = itemCreateSchema;

export const categorySchema = z.object({
  name: trimmed.min(1, "Kategori adı gerekli").max(60, "En çok 60 karakter"),
  icon: emptyToUndefined(trimmed.max(8)),
});

export const fieldCreateSchema = z.object({
  label: trimmed.min(1, "Alan adı gerekli").max(40, "En çok 40 karakter"),
  type: z.enum(FIELD_TYPES, { errorMap: () => ({ message: "Geçersiz alan tipi" }) }),
  required: z.coerce.boolean().default(false),
  // Seçenekler formda satır satır girilir.
  options: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return [];
      const list = Array.isArray(value) ? value : value.split("\n");
      return list.map((option) => option.trim()).filter(Boolean).slice(0, 40);
    }),
});

export const fieldUpdateSchema = z.object({
  label: trimmed.min(1, "Alan adı gerekli").max(40, "En çok 40 karakter").optional(),
  required: z.boolean().optional(),
  hidden: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

export const itemStatusSchema = z.object({
  status: z.enum(ITEM_STATUS, {
    errorMap: () => ({ message: "Geçersiz durum" }),
  }),
});

/** Zod hatasını kullanıcıya gösterilecek tek cümleye indirir. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Geçersiz veri";
}
