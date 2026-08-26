import { normalizeBaseUrl } from "@/lib/qr";

/**
 * Salt-okunur paylaşım linki — saf ve testli.
 *
 * Servise giderken teknisyene ürünün geçmişini hesap açtırmadan göstermek
 * için (docs/URUN.md). Bağlantı süreli ve iptal edilebilir; tutarlar
 * paylaşılmıyor — servisin görmesi gereken şey ne alındığı değil, ne yapıldığı.
 */

export const SHARE_TOKEN_LENGTH = 32;

/** Bağlantı ömrü seçenekleri. */
export const SHARE_DURATIONS = [
  { days: 1, label: "1 gün" },
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
] as const;

export type ShareDuration = (typeof SHARE_DURATIONS)[number]["days"];

export function isValidDuration(days: number): days is ShareDuration {
  return SHARE_DURATIONS.some((option) => option.days === days);
}

/**
 * Tahmin edilemez anahtar. Web Crypto kullanılıyor: bu modülü istemci de içe
 * aktarabilsin (TUZAKLAR #38).
 */
export function generateToken(
  random: (bytes: Uint8Array) => void = (bytes) => crypto.getRandomValues(bytes),
): string {
  const bytes = new Uint8Array(SHARE_TOKEN_LENGTH / 2);
  random(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isValidToken(token: string): boolean {
  return new RegExp(`^[0-9a-f]{${SHARE_TOKEN_LENGTH}}$`).test(token);
}

export function expiryFromNow(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

export type ShareRecord = {
  expiresAt: Date;
  revokedAt: Date | null;
};

export type ShareState = "valid" | "expired" | "revoked";

export function shareState(share: ShareRecord, now: Date = new Date()): ShareState {
  if (share.revokedAt) return "revoked";
  // Süre bitim anına kadar geçerli; karşılaştırma tek yerde (TUZAKLAR #27).
  if (share.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export const SHARE_STATE_LABELS: Record<ShareState, string> = {
  valid: "Geçerli",
  expired: "Süresi doldu",
  revoked: "İptal edildi",
};

export function shareUrl(baseUrl: string | undefined | null, token: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const path = `/p/${token}`;
  return base ? `${base}${path}` : path;
}

/** Kalan süre metni; listede bağlantının yanında görünüyor. */
export function remainingText(share: ShareRecord, now: Date = new Date()): string {
  const state = shareState(share, now);
  if (state !== "valid") return SHARE_STATE_LABELS[state];

  const ms = share.expiresAt.getTime() - now.getTime();
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return "1 saatten az kaldı";
  if (hours < 24) return `${hours} saat kaldı`;
  return `${Math.ceil(hours / 24)} gün kaldı`;
}
