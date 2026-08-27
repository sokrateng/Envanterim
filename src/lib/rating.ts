/**
 * Beğeni yıldızı — saf ve testli.
 *
 * "Hangi makine gerçekten kullanılıyor?" sorusunun cevabı. Ortalama
 * saklanmıyor, puanlardan hesaplanıyor (CLAUDE.md: türetilmiş değer saklanmaz).
 */

export const MIN_STARS = 1;
export const MAX_STARS = 5;

export function isValidStars(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_STARS &&
    value <= MAX_STARS
  );
}

/** Puan yoksa null: "0 yıldız" ile "puanlanmamış" aynı şey değil. */
export function averageStars(values: number[]): number | null {
  const valid = values.filter(isValidStars);
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  // Tek ondalık yeter; "4,33 yıldız" kimseye bir şey söylemiyor.
  return Math.round((total / valid.length) * 10) / 10;
}

/** "4,3" — virgüllü, tam sayıysa ondalıksız. */
export function formatStars(average: number | null): string {
  if (average === null) return "—";
  return Number.isInteger(average)
    ? String(average)
    : average.toFixed(1).replace(".", ",");
}

/**
 * Kaç yıldız dolu çizilecek. Yarım yıldız çizmiyoruz: 44 piksellik dokunma
 * hedefinde yarım yıldız hem görünmüyor hem yanlış anlaşılıyor.
 */
export function filledStars(average: number | null): number {
  if (average === null) return 0;
  return Math.min(MAX_STARS, Math.max(0, Math.round(average)));
}

/**
 * Yıldızların yanındaki kısa özet.
 *
 * Puan yokken "Henüz puan yok" demek boşluğu tarif ediyordu; oysa oradaki
 * asıl bilgi yıldızlara dokunulabildiği. Puan varken ortalama önce geliyor:
 * kaç kişi verdiği ikincil.
 */
export function ratingSummary(count: number, average: number | null): string {
  if (count === 0 || average === null) return "Puan ver";
  return `${formatStars(average)} · ${count} kişi`;
}
