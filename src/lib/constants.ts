// Şemada enum yok; sabitler burada metin olarak durur (CLAUDE.md).
// Yeni bir değer eklemek göç değil, bu dosyada bir satır.

export const USER_STATUS = ["PENDING", "ACTIVE", "FROZEN"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Sahip",
  EDITOR: "Düzenleyen",
  VIEWER: "Görüntüleyen",
};

export const ITEM_STATUS = ["IN_USE", "IN_REPAIR", "RETIRED", "SOLD"] as const;
export type ItemStatus = (typeof ITEM_STATUS)[number];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  IN_USE: "Kullanımda",
  IN_REPAIR: "Serviste",
  RETIRED: "Emekli",
  SOLD: "Satıldı",
};

export const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOL"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Metin",
  NUMBER: "Sayı",
  DATE: "Tarih",
  SELECT: "Seçim",
  BOOL: "Evet/Hayır",
};

export const ATTACHMENT_KINDS = [
  "PHOTO",
  "INVOICE",
  "WARRANTY",
  "MANUAL",
  "OTHER",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const ATTACHMENT_KIND_LABELS: Record<string, string> = {
  PHOTO: "Fotoğraf",
  INVOICE: "Fatura",
  WARRANTY: "Garanti belgesi",
  MANUAL: "Kılavuz",
  OTHER: "Diğer",
};

export const EVENT_KINDS = ["READING", "SERVICE", "LOG", "ASSIGNMENT"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const REMINDER_KINDS = ["WARRANTY", "MAINTENANCE"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Garanti bitimine kaç gün kala uyarı gider (MIMARI §4). */
export const WARRANTY_LEAD_DAYS = [30, 7] as const;

/**
 * Zimmet durumu. Kayıtta durum alanı yok; bu değerler tarih alanlarından
 * türetiliyor (src/lib/assignment.ts) — türetilmiş değer saklanmıyor.
 */
export const ASSIGNMENT_STATES = ["PENDING", "HELD", "RETURNED", "TRANSFERRED", "DECLINED"] as const;
export type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

export const ASSIGNMENT_STATE_LABELS: Record<AssignmentState, string> = {
  PENDING: "Teslim bekliyor",
  HELD: "Üzerinde",
  RETURNED: "İade edildi",
  TRANSFERRED: "Devredildi",
  DECLINED: "Kabul edilmedi",
};

/** Zimmetin nasıl kapandığı. */
export const ASSIGNMENT_CLOSE_REASONS = ["RETURN", "TRANSFER", "DECLINE"] as const;
export type AssignmentCloseReason = (typeof ASSIGNMENT_CLOSE_REASONS)[number];

/** Bu kadar gün kabul edilmeyen zimmet raporda geciken sayılır. */
export const ASSIGNMENT_OVERDUE_DAYS = 3;

/** Alt ekipman zinciri bu kadar derin olabilir: ana → alt → altın altı. */
export const MAX_COMPONENT_DEPTH = 3;
