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
