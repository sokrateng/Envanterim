/**
 * Kaydırma jestinin matematiği — saf ve testli.
 *
 * iOS listelerinde satırı sola çekince sağdaki, sağa çekince soldaki işlem
 * düğmeleri çıkar. Jestin kendisi basit ama üç şeyi yanlış yapmak kolay: dikey
 * kaydırmayı çalmak, parmak bırakıldığında yarım yolda kalmak ve yıkıcı işlemi
 * tek dokunuşla yaptırmak. Karar burada, hareketin kendisi bileşende.
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

/** Hangi taraftaki düğmeler açık: sağa çekince sol, sola çekince sağ. */
export type SwipeSide = "leading" | "trailing" | null;

/**
 * Panellerin genişliğini aşmayan açılma miktarı. Panelin olmadığı yöne
 * çekilemiyor: boşluğa doğru esneyen satır "bozuk" hissettiriyor.
 */
export function clampOffset(
  dx: number,
  trailingWidth: number,
  leadingWidth = 0,
): number {
  if (dx > 0) return Math.min(dx, leadingWidth);
  return Math.max(dx, -trailingWidth);
}

/** Parmak kalkınca hangi taraf açık kalsın: mesafe ya da hız yeterli mi. */
export function settle(
  offset: number,
  trailingWidth: number,
  leadingWidth: number,
  velocity = 0,
): SwipeSide {
  // Hızlı bir fiske kısa da olsa açar; iOS'ta böyle.
  if (trailingWidth > 0 && (velocity < -0.5 || offset <= -trailingWidth * OPEN_RATIO)) {
    return "trailing";
  }
  if (leadingWidth > 0 && (velocity > 0.5 || offset >= leadingWidth * OPEN_RATIO)) {
    return "leading";
  }
  return null;
}

/** Piksel/ms cinsinden hız; sıfır süre bölmesi olmasın. */
export function velocity(dx: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return dx / elapsedMs;
}
