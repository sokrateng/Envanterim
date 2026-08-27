import { z } from "zod";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  FIELD_TYPES,
  ITEM_STATUS,
  ROLES,
} from "@/lib/constants";
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
  // Tutar hangi birimde girildiyse o birimde duruyor; çeviri yok.
  currency: z
    .enum(CURRENCIES, { errorMap: () => ({ message: "Geçersiz para birimi" }) })
    .default(DEFAULT_CURRENCY),
  warrantyEndDate: emptyToUndefined(dateOnly),
  status: z
    .enum(ITEM_STATUS, { errorMap: () => ({ message: "Geçersiz durum" }) })
    .default("IN_USE"),
  categoryId: emptyToUndefined(trimmed),
  sellerId: emptyToUndefined(trimmed),
  // Listede olmayan satıcı formda adıyla yazılır; sunucu varsa bulur, yoksa
  // açar. Satıcı için ayrı bir yönetim ekranına gerek kalmıyor.
  sellerName: emptyToUndefined(trimmed.max(80, "En çok 80 karakter")),
  // Dinamik alanlar burada ham gelir; asıl doğrulama kategori tanımlarından
  // üretilen şemayla yapılır (src/lib/custom-fields.ts).
  customFields: z.record(z.unknown()).default({}),
});

export const itemUpdateSchema = itemCreateSchema;

export const serviceCreateSchema = z.object({
  complaint: trimmed
    .min(1, "Arıza açıklaması gerekli")
    .max(500, "En çok 500 karakter"),
  sentAt: emptyToUndefined(dateOnly),
  vendorId: emptyToUndefined(trimmed),
  // Listede olmayan servis formda adıyla yazılır; sunucu varsa bulur, yoksa açar.
  vendorName: emptyToUndefined(trimmed.max(80, "En çok 80 karakter")),
  trackingNo: emptyToUndefined(trimmed.max(60, "En çok 60 karakter")),
});

export const serviceCloseSchema = z.object({
  returnedAt: emptyToUndefined(dateOnly),
  work: emptyToUndefined(trimmed.max(1000, "En çok 1000 karakter")),
  cost: emptyToUndefined(moneyMinor),
  paid: z.coerce.boolean().default(false),
  underWarranty: z.coerce.boolean().default(false),
});

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

/**
 * Olay kaydı. Dört tür de aynı tabloda; her türün kendi alanları var, bu
 * yüzden ayrık birleşim (MIMARI §3).
 */
const eventBase = {
  date: dateOnly,
  note: emptyToUndefined(trimmed.max(500, "En çok 500 karakter")),
};

export const eventCreateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SERVICE"),
    ...eventBase,
    vendorId: emptyToUndefined(trimmed),
    vendorName: emptyToUndefined(trimmed.max(80, "En çok 80 karakter")),
    cost: emptyToUndefined(moneyMinor),
  }),
  z.object({
    kind: z.literal("READING"),
    ...eventBase,
    // Sayaç değeri metin değil sayı: bakım kuralı buna bakıyor (MIMARI §3).
    readingValue: z.coerce
      .number({ invalid_type_error: "Sayaç değeri sayı olmalı" })
      .finite("Sayaç değeri sayı olmalı")
      .min(0, "Sayaç değeri eksi olamaz"),
    readingUnit: emptyToUndefined(trimmed.max(12, "En çok 12 karakter")),
  }),
  z.object({
    kind: z.literal("LOG"),
    ...eventBase,
  }),
  z.object({
    kind: z.literal("ASSIGNMENT"),
    ...eventBase,
    assignedToUserId: emptyToUndefined(trimmed),
    assignedPlace: emptyToUndefined(trimmed.max(80, "En çok 80 karakter")),
  }),
]);

export const partCreateSchema = z.object({
  name: trimmed.min(1, "Parça adı gerekli").max(80, "En çok 80 karakter"),
  partNo: emptyToUndefined(trimmed.max(60, "En çok 60 karakter")),
  price: emptyToUndefined(moneyMinor),
  vendorId: emptyToUndefined(trimmed),
  vendorName: emptyToUndefined(trimmed.max(80, "En çok 80 karakter")),
  stock: emptyToUndefined(
    z.coerce
      .number({ invalid_type_error: "Stok sayı olmalı" })
      .int("Stok tam sayı olmalı")
      .min(0, "Stok eksi olamaz")
      .max(100000, "Stok çok büyük"),
  ),
});

export const maintenanceRuleSchema = z
  .object({
    name: trimmed.min(1, "Bakım adı gerekli").max(60, "En çok 60 karakter"),
    everyMonths: emptyToUndefined(
      z.coerce
        .number({ invalid_type_error: "Ay sayı olmalı" })
        .int("Ay tam sayı olmalı")
        .min(1, "En az 1 ay")
        .max(240, "En çok 240 ay"),
    ),
    everyReading: emptyToUndefined(
      z.coerce
        .number({ invalid_type_error: "Sayaç aralığı sayı olmalı" })
        .positive("Sayaç aralığı sıfırdan büyük olmalı")
        .max(10_000_000, "Sayaç aralığı çok büyük"),
    ),
    readingUnit: emptyToUndefined(trimmed.max(12, "En çok 12 karakter")),
    leadDays: z.coerce.number().int().min(0).max(90).default(7),
  })
  // Kuralın neye göre tekrarladığı belli olmalı; ikisi de boşsa hiç
  // hatırlatılamaz.
  .refine((rule) => rule.everyMonths || rule.everyReading, {
    message: "Ay ya da sayaç aralığından biri gerekli",
  });

export const itemStatusSchema = z.object({
  status: z.enum(ITEM_STATUS, {
    errorMap: () => ({ message: "Geçersiz durum" }),
  }),
});

/**
 * Zimmet. Sorumlu ya hesabı olan bir üye ya da hesabı olmayan bir kişidir;
 * ikisinden biri gelmek zorunda, ikisi birden değil.
 */
export const assignmentCreateSchema = z
  .object({
    holderUserId: emptyToUndefined(trimmed),
    holderName: emptyToUndefined(trimmed.max(80, "En çok 80 karakter")),
    note: emptyToUndefined(trimmed.max(200, "En çok 200 karakter")),
    // Ana ekipman devrolurken bileşenleri de taşınsın mı.
    withComponents: z.boolean().default(true),
  })
  .refine((data) => Boolean(data.holderUserId) !== Boolean(data.holderName), {
    message: "Kime zimmetleneceğini seç",
  });

export const assignmentActionSchema = z.object({
  islem: z.enum(["KABUL", "RED", "IADE"], {
    errorMap: () => ({ message: "Geçersiz işlem" }),
  }),
});

/** Alt ekipman bağı. Boş değer bağı kaldırır. */
export const componentLinkSchema = z.object({
  parentId: z.union([trimmed, z.null()]).transform((value) => value || null),
});

/** Şifre değiştirme: mevcut şifre olmadan olmuyor. */
export const passwordChangeSchema = z.object({
  mevcut: z.string().min(1, "Mevcut şifre gerekli"),
  yeni: z.string().min(8, "Yeni şifre en az 8 karakter"),
});

/** Şifre sıfırlama: önce kod istenir, sonra kodla yeni şifre konur. */
export const resetRequestSchema = z.object({
  username: trimmed.min(1, "Kullanıcı adı gerekli"),
});

export const resetConfirmSchema = z.object({
  username: trimmed.min(1, "Kullanıcı adı gerekli"),
  kod: trimmed.min(1, "Kod gerekli"),
  yeni: z.string().min(8, "Yeni şifre en az 8 karakter"),
});

/** Zod hatasını kullanıcıya gösterilecek tek cümleye indirir. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Geçersiz veri";
}
