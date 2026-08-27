/**
 * Çoklu seçimli filtrelerin adres çubuğundaki hâli — saf ve testli.
 *
 * "Pasif hariç hepsi" demenin doğal yolu kalanları seçmek. Bu yüzden durum,
 * lokasyon ve kategori birden fazla değer alıyor; adres çubuğunda virgülle
 * yazılıyor (`durum=IN_USE,IN_REPAIR,SOLD`).
 *
 * Gelen değer kullanıcıdan geliyor: izinli küme dışındaki her şey eleniyor —
 * sorgu uydurma bir değeri veritabanına taşımıyor. Tekrarlar da eleniyor,
 * yoksa aynı seçim iki kez sayılıp rozetteki sayıyı şişirirdi.
 */

/** Kimlik uzunluğu ve seçim sayısı sınırı: uydurma bir adres sorguyu şişirmesin. */
const MAX_VALUES = 30;
const MAX_LENGTH = 64;

/**
 * Adresteki virgüllü değeri süzer.
 *
 * `allowed` verilirse yalnız o kümedekiler geçiyor (durum, lokasyon). Kategori
 * kimlikleri sorgudan önce bilinmediği için `null` geçiliyor: satırlar zaten
 * üye olunan lokasyonlarla sınırlı, uydurma bir kimlik hiçbir satıra denk
 * gelmiyor. O durumda da boy ve sayı sınırlanıyor.
 */
export function parseValues(
  raw: string | undefined | null,
  allowed: readonly string[] | null,
): string[] {
  if (!raw) return [];

  const izinli = allowed ? new Set(allowed) : null;
  const secilen: string[] = [];

  for (const parca of raw.split(",")) {
    const value = parca.trim();
    if (!value || value.length > MAX_LENGTH) continue;
    if (izinli && !izinli.has(value)) continue;
    if (!secilen.includes(value)) secilen.push(value);
    if (secilen.length === MAX_VALUES) break;
  }
  return secilen;
}

/** Seçimi adres çubuğuna yazılacak hâle getirir; boşsa parametre hiç yazılmıyor. */
export function toParam(values: readonly string[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}

/**
 * Çipe dokunma: seçiliyse çıkarır, değilse ekler.
 *
 * Sıra korunuyor — kullanıcı seçtiği sırayı adres çubuğunda görüyor ve
 * paylaşılan bağlantı her açılışta aynı şeyi gösteriyor.
 */
export function toggleValue(
  values: readonly string[],
  value: string,
): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}
