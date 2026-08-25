/**
 * Davet kodu: sahip üretir, davet edilen kişi kayıt olurken kullanır ve
 * doğrudan o lokasyona üye olur.
 *
 * Alfabede karışan harf yok (0/O, 1/I/L): kod telefonda okunup elle yazılıyor.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 10;
export const INVITE_VALID_DAYS = 7;

/**
 * Web Crypto kullanılır, `node:crypto` değil: bu modülü istemci bileşeni de
 * içe aktarıyor (rozet etiketleri) ve `node:` şeması istemci paketinde
 * derlenmiyor.
 *
 * Kalanla eşleme sapma yaratır (256 % 31 ≠ 0); sınırın üstündeki bayt atılır.
 */
function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  const byte = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(byte);
    if (byte[0] < limit) return byte[0] % max;
  }
}

export function generateInviteCode(
  random: (max: number) => number = randomIndex,
): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += ALPHABET[random(ALPHABET.length)];
  }
  return code;
}

/** Kullanıcı "abc-def" ya da küçük harf yazabilir; tek biçime indir. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type InviteRecord = {
  expiresAt: Date;
  usedAt: Date | null;
};

export type InviteState = "valid" | "used" | "expired";

export function inviteState(
  invite: InviteRecord,
  now: Date = new Date(),
): InviteState {
  if (invite.usedAt) return "used";
  // Süre bitimi ana kadar geçerli: sınırı tek yerde karşılaştır (TUZAKLAR #27).
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export const INVITE_STATE_LABELS: Record<InviteState, string> = {
  valid: "Geçerli",
  used: "Kullanıldı",
  expired: "Süresi doldu",
};

export function inviteExpiry(
  now: Date = new Date(),
  days = INVITE_VALID_DAYS,
): Date {
  return new Date(now.getTime() + days * 86_400_000);
}
