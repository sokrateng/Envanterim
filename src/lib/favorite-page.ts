/**
 * Favoriler listenin başında — sayfalama matematiği, saf ve testli.
 *
 * Favori kişiye ait bir işaret; veritabanı tek sorguda "önce benim
 * favorilerim" diye sıralayamıyor (ilişki sayısına göre sıralamak başkasının
 * işaretini de sayardı). Bu yüzden iki sorgu: favoriler ve kalanlar. Bu
 * modül, istenen sayfanın hangi dilimlere denk geldiğini söylüyor.
 *
 * Sayfa sınırında liste ikiye bölünüyor: favorilerin son birkaçı ve
 * kalanların ilk birkaçı aynı sayfaya düşebiliyor.
 */

export type PageSlice = {
  favoriteSkip: number;
  favoriteTake: number;
  otherSkip: number;
  otherTake: number;
};

export function favoritePage({
  offset,
  size,
  favoriteCount,
}: {
  /** Sayfanın başlangıcı (kaçıncı satırdan itibaren). */
  offset: number;
  size: number;
  favoriteCount: number;
}): PageSlice {
  const favoriteSkip = Math.min(offset, favoriteCount);
  const favoriteTake = Math.max(0, Math.min(size, favoriteCount - offset));
  return {
    favoriteSkip,
    favoriteTake,
    // Favoriler bittikten sonra kalanlar başlıyor: bu sayfada kaç favori
    // gösterildiyse o kadar az "kalan" gerekiyor.
    otherSkip: Math.max(0, offset - favoriteCount),
    otherTake: size - favoriteTake,
  };
}
