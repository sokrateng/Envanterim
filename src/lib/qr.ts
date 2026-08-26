/**
 * QR etiket adresleri — saf ve testli.
 *
 * Etiket cihazın üstüne yapıştırılıyor; okutunca ürün sayfası açılmalı
 * (docs/URUN.md). Adres kısa ve kalıcı olmalı: ürün kimliği değişmiyor,
 * uygulama adresi değişse bile etiket yeniden basılabiliyor.
 */

/** Sondaki eğik çizgiyi ve boşluğu atar; şema yoksa https ekler. */
export function normalizeBaseUrl(input: string | undefined | null): string {
  const text = (input ?? "").trim();
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return withScheme.replace(/\/+$/, "");
}

export function itemUrl(baseUrl: string | undefined | null, itemId: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const path = `/envanter/${itemId}`;
  return base ? `${base}${path}` : path;
}

export type LabelLine = { label: string; value: string };

/**
 * Etikette QR'ın yanında ne yazacağı. Sığmayan alan atlanıyor: etiket küçük,
 * en çok üç satır okunur duruyor.
 */
export function labelLines(item: {
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNo?: string | null;
  locationName?: string | null;
}): LabelLine[] {
  const lines: LabelLine[] = [];

  const marka = [item.brand, item.model].filter(Boolean).join(" ").trim();
  if (marka) lines.push({ label: "Marka", value: marka });
  if (item.serialNo) lines.push({ label: "Seri no", value: item.serialNo });
  if (item.locationName) lines.push({ label: "Lokasyon", value: item.locationName });

  return lines.slice(0, 3);
}

/**
 * Etiket adı uzunsa kırpılır — tek satırda kalsın. Kelimenin ortasından
 * kesmek yerine son boşluktan kesiyoruz; "Buzdolabı b…" okunmuyor.
 */
export function labelTitle(name: string, max = 28): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;

  const kesilmis = trimmed.slice(0, max - 1);
  const sonBosluk = kesilmis.lastIndexOf(" ");
  // Çok erken bir boşluktan kesmek adı tanınmaz yapar; o zaman sert kes.
  const govde =
    sonBosluk >= Math.floor(max * 0.6) ? kesilmis.slice(0, sonBosluk) : kesilmis;

  return `${govde.trimEnd()}…`;
}
