/**
 * Firma iletişim bilgilerinin biçimi — saf ve testli.
 *
 * Kullanıcı adresi "bosch.com.tr" diye yazıyor, bağlantı ise şema istiyor.
 * Şemayı biz tamamlıyoruz ama her şemayı değil: `javascript:` ya da `data:`
 * bir bağlantı, dokunulduğunda sayfanın içinde kod çalıştırma denemesidir —
 * kullanıcının yazdığı metin doğrudan `href` olmamalı.
 */

/** Bağlantı olarak kullanılabilecek adres; olmuyorsa null. */
export function websiteHref(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  // Şema yazılmamışsa https varsayılıyor: kullanıcı "bosch.com.tr" yazıyor.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;

  return url.toString();
}

/** Ekranda görünen kısa hâli: şema ve sondaki eğik çizgi olmadan. */
export function websiteLabel(value: string | null | undefined): string | null {
  const href = websiteHref(value);
  if (!href) return null;
  return href.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * `tel:` bağlantısı. Boşluk ve parantez atılıyor, baştaki + korunuyor —
 * telefon uygulaması aradaki süsleri çevirmiyor.
 */
export function phoneHref(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  const digits = text.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+")
    ? `+${digits.slice(1).replace(/\+/g, "")}`
    : digits.replace(/\+/g, "");

  // Tek haneli bir şey telefon değil; yanlış bağlantı vermektense hiç verme.
  if (normalized.replace("+", "").length < 7) return null;
  return `tel:${normalized}`;
}
