/**
 * Başlık puntosu — saf ve testli.
 *
 * Uzun ekipman adları 34 piksellik başlıkta dört satıra taşıp mobilde içeriği
 * ekranın dışına itiyordu. Ad alanı sabit yükseklikte; metin uzadıkça punto
 * küçülüyor. Sınıf adı dizgi birleştirerek üretilmiyor (CLAUDE.md), tam sınıf
 * listesinden seçiliyor.
 */

/** Sabit ad alanının yüksekliği: 34px başlığın iki satırı. */
export const TITLE_BOX = "h-[82px]";

type Step = {
  className: string;
  /** 390 piksellik ekranda (fotoğraf ve "Düzenle" düştükten sonra) satır başına
   *  yaklaşık karakter. */
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
  { className: "text-large-title tracking-tight line-clamp-2", perLine: 10, lines: 2 },
  { className: "text-title line-clamp-2", perLine: 15, lines: 2 },
  { className: "text-headline line-clamp-3", perLine: 20, lines: 3 },
  { className: "text-subheadline line-clamp-4", perLine: 23, lines: 4 },
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
