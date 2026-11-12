/**
 * VAPID ayarının biçim kontrolü — saf ve testli.
 *
 * `VAPID_SUBJECT` bir **adres** olmak zorunda: `mailto:` ya da `https://`.
 * Etiket girilirse push kütüphanesi doğrulamada hata fırlatıyor; bunu önceden
 * yakalayıp özelliği kapalı bırakmak, çalışan bir uçta patlamasından iyidir.
 */
export function isValidVapidSubject(subject: string): boolean {
  return /^(mailto:\S+@\S+\.\S+|https:\/\/\S+)$/.test(subject.trim());
}

/**
 * Kullanıcının yazdığını `VAPID_SUBJECT` biçimine çevirir. İnsanlar "mailto:"
 * yazmaz, düz e-posta yazar; ekranda bunu istemek gereksiz bir tuzak olurdu.
 * Geçersizse null döner.
 */
export function normalizeVapidSubject(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const candidate =
    /^(mailto:|https:\/\/)/i.test(value) || !value.includes("@")
      ? value
      : `mailto:${value}`;

  return isValidVapidSubject(candidate) ? candidate : null;
}
