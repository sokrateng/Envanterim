/**
 * Envanter listesinde bırakılan süzme, sekmeye dönünce geri geliyor.
 *
 * Süzme adres çubuğunda duruyor: bağlantı paylaşılabiliyor, geri tuşu
 * çalışıyor ve sunucu bileşeni sorguyu doğrudan okuyor. Bu yüzden tarayıcı
 * yenilemesi süzmeyi zaten koruyor — kaybolduğu tek yer alt çubuktaki sekme:
 * düz bir `/envanter` bağlantısı sorguyu baştan yazıyor. Son hâli saklayıp
 * bağlantıya geri koyuyoruz.
 *
 * Saklanan şey **kullanıcının bıraktığı hâl**: süzme temizlendiyse boş dizgi
 * saklanıyor. Yoksa "Temizle" bir sonraki dönüşte kendiliğinden geri alınır,
 * kullanıcı da süzmeden kurtulamazdı.
 *
 * Sayfa numarası saklanmıyor: liste son değişene göre sıralı, ikinci
 * ziyarette yedinci sayfa artık aynı satırları göstermiyor. Panelin `yeni` ve
 * `seri` işaretleri de tek seferlik, onlar da geçmiyor.
 */

/** Listenin hâlini oluşturan parametreler; sıra sabit ki adres oynamasın. */
const FILTER_KEYS = [
  "q",
  "durum",
  "lokasyon",
  "kategori",
  "garanti",
  "zimmet",
  "favori",
] as const;

const STORE_KEY = "envanterim:envanter-filtre";

/** Sorgudan yalnız süzme parametrelerini alır. */
export function filterQuery(search: string): string {
  const gelen = new URLSearchParams(search);
  const kalan = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = gelen.get(key);
    if (value) kalan.set(key, value);
  }
  return kalan.toString();
}

/** Süzmeyi taşıyan envanter adresi; `extra` panel işaretleri için. */
export function inventoryHref(
  query: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams(filterQuery(query));
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const text = params.toString();
  return text ? `/envanter?${text}` : "/envanter";
}

/**
 * Depoya erişim sarmalanıyor: Safari'nin gizli sekmesinde `localStorage`
 * yazması hata atıyor ve süzmeyi hatırlamamak uygulamayı durduracak bir şey
 * değil.
 */
export function rememberFilters(search: string): void {
  try {
    window.localStorage.setItem(STORE_KEY, filterQuery(search));
  } catch {
    // Depo kapalı; süzme yalnız adres çubuğunda yaşar.
  }
}

export function readFilters(): string {
  try {
    return window.localStorage.getItem(STORE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Çıkışta siliniyor: ortak cihazda bir sonraki kullanıcıya lokasyon ve
 * kategori kimliği taşımasın. */
export function forgetFilters(): void {
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Depo kapalı; silinecek bir şey de yok.
  }
}
