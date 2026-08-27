import { describe, expect, it } from "vitest";
import { coverWindow } from "@/lib/camera-window";

const video = { width: 1920, height: 1080 };
const box = { width: 390, height: 520 };

describe("coverWindow", () => {
  it("kutuda kare görünen pencere videoda da kare çıkıyor", () => {
    // Kutu dikey, video yatay: object-cover kenarlardan kırpıyor.
    const rect = coverWindow(video, box, { width: 0.82, height: 0.615 });
    expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(2);
  });

  it("pencere videonun ortasında kalıyor", () => {
    const rect = coverWindow(video, box, { width: 0.5, height: 0.5 });
    // Yuvarlama yüzünden yarım pikselden fazla sapmamalı.
    expect(Math.abs(rect.x + rect.width / 2 - video.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(rect.y + rect.height / 2 - video.height / 2)).toBeLessThanOrEqual(1);
  });

  it("yakınlaştırma pencereyi daraltıyor", () => {
    const bir = coverWindow(video, box, { width: 0.8, height: 0.6 }, 1);
    const iki = coverWindow(video, box, { width: 0.8, height: 0.6 }, 2);
    expect(iki.width).toBeCloseTo(bir.width / 2, 0);
    expect(iki.height).toBeCloseTo(bir.height / 2, 0);
  });

  it("pencere videoyu aşamıyor", () => {
    const rect = coverWindow(video, box, { width: 5, height: 5 });
    expect(rect.width).toBeLessThanOrEqual(video.width);
    expect(rect.height).toBeLessThanOrEqual(video.height);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
  });

  it("ölçü yoksa tüm kareyi veriyor", () => {
    expect(coverWindow(video, { width: 0, height: 0 }, { width: 0.8, height: 0.8 })).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("dikey kamera karesinde de kutuyla hizalı", () => {
    // Bazı cihazlar dikey kare veriyor; kırpma bu kez üstten alttan oluyor.
    const dikey = { width: 1080, height: 1920 };
    const rect = coverWindow(dikey, box, { width: 0.82, height: 0.615 });
    expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(2);
    expect(rect.width).toBeLessThanOrEqual(dikey.width);
  });
});
