import { describe, expect, it } from "vitest";
import {
  DIRECTION_THRESHOLD,
  clampOffset,
  direction,
  settleOpen,
  velocity,
} from "./swipe";

describe("direction", () => {
  it("eşiğin altında karar vermez", () => {
    expect(direction({ dx: 3, dy: 2 })).toBe("unknown");
  });

  it("yatay hareket jesti başlatır", () => {
    expect(direction({ dx: -30, dy: 4 })).toBe("horizontal");
  });

  it("dikey hareket listeyi kaydırsın", () => {
    expect(direction({ dx: -4, dy: 30 })).toBe("vertical");
  });

  it("eşitlikte dikey kazanır — kaydırmak jestten sık", () => {
    expect(direction({ dx: -DIRECTION_THRESHOLD, dy: DIRECTION_THRESHOLD })).toBe(
      "vertical",
    );
  });
});

describe("clampOffset", () => {
  it("sağa çekmeye izin vermez", () => {
    expect(clampOffset(40, 160)).toBe(0);
  });

  it("panel genişliğini aşmaz", () => {
    expect(clampOffset(-400, 160)).toBe(-160);
  });

  it("aradaki değeri olduğu gibi verir", () => {
    expect(clampOffset(-70, 160)).toBe(-70);
  });
});

describe("settleOpen", () => {
  it("yarıdan az çekilirse kapanır", () => {
    expect(settleOpen(-40, 160)).toBe(false);
  });

  it("eşiği geçerse açık kalır", () => {
    expect(settleOpen(-70, 160)).toBe(true);
  });

  it("hızlı fiske kısa mesafede de açar", () => {
    expect(settleOpen(-20, 160, -1.2)).toBe(true);
  });

  it("genişlik ölçülmediyse açmaz", () => {
    expect(settleOpen(-20, 0)).toBe(false);
  });
});

describe("velocity", () => {
  it("piksel/ms verir", () => {
    expect(velocity(-100, 200)).toBe(-0.5);
  });

  it("sıfır süreye bölmez", () => {
    expect(velocity(-100, 0)).toBe(0);
  });
});
