import { describe, expect, it } from "vitest";
import {
  IDENTITY,
  MAX_SCALE,
  clampOffset,
  clampScale,
  distance,
  doubleTapScale,
  isZoomed,
  midpoint,
  pan,
  toTransform,
  zoomAt,
} from "./zoom";

const view = { width: 390, height: 600 };

describe("clampScale", () => {
  it("sınırların içinde tutar", () => {
    expect(clampScale(0.2)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(99)).toBe(MAX_SCALE);
  });

  it("sayı olmayanı en küçük ölçeğe düşürür", () => {
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MAX_SCALE);
  });
});

describe("distance / midpoint", () => {
  it("iki parmağın arası", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("orta nokta", () => {
    expect(midpoint({ x: -10, y: 4 }, { x: 20, y: 6 })).toEqual({ x: 5, y: 5 });
  });

  it("sıfırın işaretini sızdırmaz", () => {
    const mid = midpoint({ x: -5, y: -5 }, { x: 5, y: 5 });
    expect(Object.is(mid.x, 0)).toBe(true);
    expect(Object.is(mid.y, 0)).toBe(true);
  });
});

describe("clampOffset", () => {
  it("ölçek 1'ken kaydırmaya izin vermez", () => {
    expect(clampOffset({ scale: 1, x: 120, y: -80 }, view)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
  });

  it("taşan yarım genişlik kadar kaydırılabilir", () => {
    // 2 kat büyütmede yatayda taşma (390*2-390)/2 = 195
    expect(clampOffset({ scale: 2, x: 400, y: 0 }, view).x).toBe(195);
    expect(clampOffset({ scale: 2, x: -400, y: 0 }, view).x).toBe(-195);
    expect(clampOffset({ scale: 2, x: 100, y: 0 }, view).x).toBe(100);
  });

  it("dikeyde de sınırlar", () => {
    expect(clampOffset({ scale: 2, x: 0, y: 999 }, view).y).toBe(300);
  });
});

describe("pan", () => {
  it("sınır içinde taşır", () => {
    const moved = pan({ scale: 2, x: 0, y: 0 }, 50, -40, view);
    expect(moved).toEqual({ scale: 2, x: 50, y: -40 });
  });

  it("sınırı aşan hareketi keser", () => {
    expect(pan({ scale: 2, x: 190, y: 0 }, 50, 0, view).x).toBe(195);
  });
});

describe("zoomAt", () => {
  it("merkezden büyütünce kaydırma oluşmaz", () => {
    expect(zoomAt(IDENTITY, { x: 0, y: 0 }, 2, view)).toEqual({
      scale: 2,
      x: 0,
      y: 0,
    });
  });

  it("odak noktası parmağın altında kalır", () => {
    const focal = { x: 100, y: 0 };
    const next = zoomAt(IDENTITY, focal, 2, view);
    // Odaktaki içerik noktası: (focal - x) / scale — büyütmeden önce ve sonra aynı olmalı.
    const before = (focal.x - IDENTITY.x) / IDENTITY.scale;
    const after = (focal.x - next.x) / next.scale;
    expect(after).toBeCloseTo(before, 5);
  });

  it("sonucu sınırların içine çeker", () => {
    const next = zoomAt(IDENTITY, { x: 195, y: 300 }, 2, view);
    expect(Math.abs(next.x)).toBeLessThanOrEqual(195);
    expect(Math.abs(next.y)).toBeLessThanOrEqual(300);
  });

  it("küçülürken kaydırmayı geri toplar", () => {
    const zoomed = { scale: 3, x: 300, y: 0 };
    const next = zoomAt(zoomed, { x: 0, y: 0 }, 1, view);
    expect(next).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("doubleTapScale / isZoomed", () => {
  it("kapalıyken açar, açıkken kapatır", () => {
    expect(doubleTapScale(1)).toBe(2.5);
    expect(doubleTapScale(2.5)).toBe(1);
    expect(doubleTapScale(6)).toBe(1);
  });

  it("yakınlaşma durumunu bildirir", () => {
    expect(isZoomed(IDENTITY)).toBe(false);
    expect(isZoomed({ scale: 1.005, x: 0, y: 0 })).toBe(false);
    expect(isZoomed({ scale: 1.5, x: 0, y: 0 })).toBe(true);
  });
});

describe("toTransform", () => {
  it("önce taşır sonra ölçekler", () => {
    expect(toTransform({ scale: 2, x: 10, y: -5 })).toBe(
      "translate(10px, -5px) scale(2)",
    );
  });
});
