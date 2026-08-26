/**
 * Sola kaydırma jestinin matematiği — saf ve testli.
 *
 * iOS listelerinde satırı sola çekince altından işlem düğmeleri çıkar. Jestin
 * kendisi basit ama üç şeyi yanlış yapmak kolay: dikey kaydırmayı çalmak,
 * parmak bırakıldığında yarım yolda kalmak ve yıkıcı işlemi tek dokunuşla
 * yaptırmak. Karar burada, hareketin kendisi bileşende.
 */

/** Yatay mı dikey mi olduğuna karar vermek için gereken en küçük hareket. */
export const DIRECTION_THRESHOLD = 8;

/** Bu kadarını geçen kaydırma parmak kalkınca açık kalır. */
export const OPEN_RATIO = 0.4;

export type Drag = { dx: number; dy: number };

export type Direction = "horizontal" | "vertical" | "unknown";

/**
 * Hareketin yönü. Karar bir kez verilir ve jest bitene kadar değişmez:
 * ortada yön değiştirmek listeyi zıplatıyor.
 */
export function direction(drag: Drag): Direction {
  const ax = Math.abs(drag.dx);
  const ay = Math.abs(drag.dy);
  if (Math.max(ax, ay) < DIRECTION_THRESHOLD) return "unknown";
  // Eşitlikte dikey kazanır: liste kaydırmak jestten daha sık yapılıyor.
  return ax > ay ? "horizontal" : "vertical";
}

/** Panelin genişliğini aşmayan, sağa çekilmeye izin vermeyen açılma miktarı. */
export function clampOffset(dx: number, width: number): number {
  if (dx >= 0) return 0;
  return Math.max(dx, -width);
}

/** Parmak kalkınca açık mı kalsın: mesafe ya da hız yeterli mi. */
export function settleOpen(
  offset: number,
  width: number,
  velocity = 0,
): boolean {
  if (width <= 0) return false;
  // Hızlı bir fiske kısa da olsa açar; iOS'ta böyle.
  if (velocity < -0.5) return true;
  return Math.abs(offset) >= width * OPEN_RATIO;
}

/** Piksel/ms cinsinden hız; sıfır süre bölmesi olmasın. */
export function velocity(dx: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return dx / elapsedMs;
}
