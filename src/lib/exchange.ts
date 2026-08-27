/**
 * Farklı para birimlerini tek bir TRY toplamına indirmek — saf ve testli.
 *
 * **Kuru biz uydurmuyoruz.** Envanterdeki tutar alış anına ait; bugünkü kurla
 * çevrilmiş bir toplam, kaynağı belirsiz bir sayı olur ve panele bakan kişi ona
 * inanır. Bu yüzden kur kullanıcıdan geliyor: girmediyse toplam para birimi
 * başına ayrı duruyor (CLAUDE.md'deki "kur çevirisi yok" kuralının koruduğu
 * şey de buydu), girdiyse tek satırda toplanıyor ve hangi kurla toplandığı
 * ekranda yazıyor.
 *
 * Kur da kuruş cinsinden tamsayı: "1 USD = 34,50 ₺" → 3450. Float kur, float
 * paranın kapıdan geri girmesi demekti.
 */

/** Bir TRY bir TRY eder; çevrim tablosunda da yeri var. */
export const TRY_RATE_MINOR = 100;

/**
 * `minor` tutarını, birimi `rateMinor` kurundan TRY kuruşuna çevirir.
 *
 * Tutar = (minor/100) birim · (rateMinor/100) ₺/birim → kuruşa çıkarken
 * yüzle çarpılıyor; sadeleşince `minor * rateMinor / 100` kalıyor. Yarım kuruş
 * yukarı yuvarlanıyor, toplamda kuruş kaybı olmasın.
 */
export function convertToTry(minor: number, rateMinor: number): number {
  return Math.round((minor * rateMinor) / 100);
}

export type RateMap = Record<string, number>;

export type TryTotal = {
  /** Çevrilebilenlerin TRY kuruş toplamı. */
  minor: number;
  /** Toplama giren birimler. */
  converted: string[];
  /** Kuru girilmediği için toplama girmeyenler. */
  missing: string[];
};

/**
 * Para birimi başına toplamları tek TRY sayısına indirir.
 *
 * Kuru olmayan birim toplama **girmiyor**; sessizce atlanmıyor da — `missing`
 * ile geri dönüyor ki ekran "şu birim dışarıda" diyebilsin. Eksik bir kuru bir
 * varsayarak toplamak, toplamı sessizce yanlışlardı.
 */
export function tryTotal(
  totals: ReadonlyArray<{ currency: string; minor: number }>,
  rates: RateMap,
): TryTotal {
  let minor = 0;
  const converted: string[] = [];
  const missing: string[] = [];

  for (const row of totals) {
    const rate = row.currency === "TRY" ? TRY_RATE_MINOR : rates[row.currency];
    if (!rate || rate <= 0) {
      if (!missing.includes(row.currency)) missing.push(row.currency);
      continue;
    }
    minor += convertToTry(row.minor, rate);
    if (!converted.includes(row.currency)) converted.push(row.currency);
  }

  return { minor, converted, missing };
}
