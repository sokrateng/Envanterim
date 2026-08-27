/**
 * Başlık puntosu — saf ve testli.
 *
 * Uzun ekipman adları başlıkta dört satıra taşıp mobilde içeriği ekranın
 * dışına itiyordu. Ad alanı sabit yükseklikte; metin uzadıkça punto
 * küçülüyor. Sınıf adı dizgi birleştirerek üretilmiyor (CLAUDE.md), tam sınıf
 * listesinden seçiliyor.
 *
 * Tavan artık Title 22 (Large Title 34 değil): fotoğraf bandı başlığın üstüne
 * taşınınca ad tam genişlikte kaldı, 34px'e gerek kalmadı.
 */

/** Sabit ad alanının yüksekliği: 22px başlığın iki satırı. */
export const TITLE_BOX = "h-[60px]";

type Step = {
  className: string;
  /** 390 piksellik ekranda ("Düzenle" düştükten sonra) satır başına yaklaşık
   *  karakter. */
  perLine: number;
  /** Sabit alana sığan satır sayısı. */
  lines: number;
};

/**
 * Adımlar büyükten küçüğe. Toplam uzunluk tek başına yetmiyor: sözcük
 * bölünmediği için "1787787457903" gibi tek parça bir sözcük satıra sığmazsa
 * kırpılıyor. Bu yüzden en uzun sözcük de sınanıyor.
 */
const STEPS: Step[] = [
  { className: "text-title tracking-tight line-clamp-2", perLine: 24, lines: 2 },
  { className: "text-headline line-clamp-3", perLine: 31, lines: 3 },
  { className: "text-subheadline line-clamp-4", perLine: 35, lines: 4 },
];

/** Satır sonlarında boşa giden yer: sözcükler tam dolduramıyor. */
const PACKING = 0.9;

export function titleClass(text: string): string {
  const trimmed = text.trim();
  const longestWord = trimmed
    .split(/\s+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0);

  const step = STEPS.find(
    (candidate) =>
      trimmed.length <= candidate.perLine * candidate.lines * PACKING &&
      longestWord <= candidate.perLine,
  );

  return (step ?? STEPS[STEPS.length - 1]).className;
}
