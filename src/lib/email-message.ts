import type { MaintenanceRule, RuleStatus } from "@/lib/maintenance";
import { statusText } from "@/lib/maintenance";
import { normalizeBaseUrl } from "@/lib/qr";
import type { PlannedReminder } from "@/lib/reminders";

/**
 * E-posta metinleri ve doğrulama kodu — saf ve testli.
 *
 * Gönderim `src/lib/mailer.ts`'te. `ItemReminder` kanaldan bağımsız olduğu
 * için e-posta şema değiştirmeden ekleniyor (docs/MIMARI.md §4): aynı damga
 * hem push hem e-posta için geçerli.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 15;
export const CODE_MAX_TRIES = 5;

/** Altı haneli doğrulama kodu. Web Crypto: modül her iki tarafta da çalışsın. */
export function generateCode(
  random: (bytes: Uint32Array) => void = (bytes) => crypto.getRandomValues(bytes),
): string {
  const buffer = new Uint32Array(1);
  random(buffer);
  const max = 10 ** CODE_LENGTH;
  return String(buffer[0] % max).padStart(CODE_LENGTH, "0");
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code.trim());
}

export function codeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
}

/** Kaba ama yeterli e-posta biçim kontrolü; asıl doğrulama koddan geçiyor. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length < 5 || email.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

export type Mail = { subject: string; text: string };

const IMZA = "\n\n—\nEnvanterim";

export function verificationMail(code: string): Mail {
  return {
    subject: `Envanterim doğrulama kodu: ${code}`,
    text:
      `Envanterim'de bu adresi doğrulamak için kod:\n\n${code}\n\n` +
      `Kod ${CODE_TTL_MINUTES} dakika geçerli. Bu isteği sen yapmadıysan ` +
      `bu e-postayı yok say; adresin hesaba bağlanmaz.` +
      IMZA,
  };
}

/** Şifre sıfırlama kodu. Kod isteyen kişi ile adres sahibi aynı olmayabilir. */
export function resetMail(code: string): Mail {
  return {
    subject: `Envanterim şifre sıfırlama kodu: ${code}`,
    text:
      `Envanterim şifreni sıfırlamak için kod:\n\n${code}\n\n` +
      `Kod ${CODE_TTL_MINUTES} dakika geçerli. Bu isteği sen yapmadıysan ` +
      `bu e-postayı yok say; şifren değişmez.` +
      IMZA,
  };
}

function itemLink(baseUrl: string | undefined | null, itemId: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return base ? `${base}/envanter/${itemId}` : `/envanter/${itemId}`;
}

export function warrantyMail(
  reminder: PlannedReminder,
  baseUrl?: string | null,
): Mail {
  const ne =
    reminder.daysLeft === 0
      ? "bugün bitiyor"
      : `${reminder.daysLeft} gün sonra bitiyor`;

  return {
    subject: `Garanti bitiyor: ${reminder.itemName}`,
    text:
      `${reminder.itemName} garantisi ${ne}.\n\n` +
      `Ürün sayfası: ${itemLink(baseUrl, reminder.itemId)}` +
      IMZA,
  };
}

/**
 * Zimmet bildirimi. Kişi ekipmanı üzerine almadan teslim sayılmıyor; posta
 * da bunu söylüyor — "sana atandı" değil, "onayını bekliyoruz".
 */
export function assignmentMail(
  item: { id: string; name: string },
  assignedByName: string,
  baseUrl?: string | null,
): Mail {
  return {
    subject: `Zimmet: ${item.name}`,
    text:
      `${assignedByName}, "${item.name}" ekipmanını sana zimmetledi.\n\n` +
      `Teslim aldıysan ürün sayfasından "Üzerime al" de; almadıysan ` +
      `"Bende değil" ile geri çevir.\n\n` +
      `Ürün sayfası: ${itemLink(baseUrl, item.id)}` +
      IMZA,
  };
}

/** Atayan tarafa: zimmet kabul edildi ya da geri çevrildi. */
export function assignmentAnswerMail(
  item: { id: string; name: string },
  holderName: string,
  accepted: boolean,
  baseUrl?: string | null,
): Mail {
  return {
    subject: `${accepted ? "Zimmet kabul edildi" : "Zimmet geri çevrildi"}: ${item.name}`,
    text:
      `${holderName}, "${item.name}" ekipmanını ` +
      `${accepted ? "üzerine aldı" : "kabul etmedi; ekipman havuza döndü"}.\n\n` +
      `Ürün sayfası: ${itemLink(baseUrl, item.id)}` +
      IMZA,
  };
}

export function maintenanceMail(
  item: { id: string; name: string },
  rule: MaintenanceRule,
  status: RuleStatus,
  baseUrl?: string | null,
): Mail {
  return {
    subject: `Bakım zamanı: ${item.name}`,
    text:
      `${item.name} için "${rule.name}" bakımı — ` +
      `${statusText(rule, status).toLocaleLowerCase("tr")}.\n\n` +
      `Ürün sayfası: ${itemLink(baseUrl, item.id)}` +
      IMZA,
  };
}
