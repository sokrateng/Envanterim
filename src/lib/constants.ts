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

export const ATTACHMENT_KINDS = [
  "PHOTO",
  "INVOICE",
  "WARRANTY",
  "MANUAL",
  "OTHER",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const EVENT_KINDS = ["READING", "SERVICE", "LOG", "ASSIGNMENT"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const REMINDER_KINDS = ["WARRANTY", "MAINTENANCE"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Garanti bitimine kaç gün kala uyarı gider (MIMARI §4). */
export const WARRANTY_LEAD_DAYS = [30, 7] as const;
