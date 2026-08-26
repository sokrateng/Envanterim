/**
 * Parmakla büyütme matematiği — saf ve testli.
 *
 * Neden kendi yakınlaştırmamız var: manifest `display: standalone` olunca iOS
 * sayfa yakınlaştırmasını tamamen kapatıyor (TUZAKLAR #8). Fatura ve ürün
 * fotoğrafını büyütmek gerektiği için hareketi kendimiz ele alıyoruz.
 */

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type ZoomState = { scale: number; x: number; y: number };

export const IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 };

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;

/** Math.min/max sıfırın işaretini koruyor; -0 sızmasın (TUZAKLAR #15). */
const zeroSafe = (value: number) => value || 0;

export function clampScale(
  scale: number,
  min = MIN_SCALE,
  max = MAX_SCALE,
): number {
  // NaN karşılaştırmalardan sağ çıkar; en küçük ölçeğe düşür.
  if (Number.isNaN(scale)) return min;
  return zeroSafe(Math.min(max, Math.max(min, scale)));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: zeroSafe((a.x + b.x) / 2), y: zeroSafe((a.y + b.y) / 2) };
}

/**
 * Görsel kutusundan taşmasın: ölçek 1'ken kaydırma yok, büyüdükçe taşan yarım
 * genişlik kadar kaydırılabiliyor.
 */
export function clampOffset(state: ZoomState, view: Size): ZoomState {
  const overflowX = Math.max(0, (view.width * state.scale - view.width) / 2);
  const overflowY = Math.max(0, (view.height * state.scale - view.height) / 2);

  return {
    scale: state.scale,
    x: zeroSafe(Math.min(overflowX, Math.max(-overflowX, state.x))),
    y: zeroSafe(Math.min(overflowY, Math.max(-overflowY, state.y))),
  };
}

export function pan(state: ZoomState, dx: number, dy: number, view: Size): ZoomState {
  return clampOffset({ ...state, x: state.x + dx, y: state.y + dy }, view);
}

/**
 * Verilen noktayı sabit tutarak ölçek değiştirir: iki parmağın ortası ekranda
 * neredeyse orada kalsın, görsel parmağın altından kaçmasın.
 *
 * `focal` görüntü kutusunun merkezine göre verilir (merkez = 0,0).
 */
export function zoomAt(
  state: ZoomState,
  focal: Point,
  nextScale: number,
  view: Size,
): ZoomState {
  const scale = clampScale(nextScale);
  const ratio = scale / state.scale;

  // Odak noktasının içerikteki karşılığı sabit kalacak şekilde kaydırma.
  const x = focal.x - (focal.x - state.x) * ratio;
  const y = focal.y - (focal.y - state.y) * ratio;

  return clampOffset({ scale, x: zeroSafe(x), y: zeroSafe(y) }, view);
}

/** Çift dokunuş: 1 ise yakınlaştır, değilse başa dön. */
export function doubleTapScale(current: number, step = 2.5): number {
  return current > MIN_SCALE + 0.01 ? MIN_SCALE : clampScale(step);
}

export function isZoomed(state: ZoomState): boolean {
  return state.scale > MIN_SCALE + 0.01;
}

/** CSS transform dizgisi; sıra önemli — önce taşı, sonra ölçekle. */
export function toTransform(state: ZoomState): string {
  return `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
}
