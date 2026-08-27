import { describe, expect, it } from "vitest";
import {
  DIRECTION_THRESHOLD,
  clampOffset,
  direction,
  settle,
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
  it("sol panel yoksa sağa çekmeye izin vermez", () => {
    expect(clampOffset(40, 160)).toBe(0);
  });

  it("sol panel varsa onun genişliğine kadar açılır", () => {
    expect(clampOffset(40, 160, 80)).toBe(40);
    expect(clampOffset(400, 160, 80)).toBe(80);
  });

  it("sağ panel genişliğini aşmaz", () => {
    expect(clampOffset(-400, 160)).toBe(-160);
  });

  it("aradaki değeri olduğu gibi verir", () => {
    expect(clampOffset(-70, 160)).toBe(-70);
  });
});

describe("settle", () => {
  it("yarıdan az çekilirse kapanır", () => {
    expect(settle(-40, 160, 80)).toBeNull();
    expect(settle(20, 160, 80)).toBeNull();
  });

  it("eşiği geçerse o taraf açık kalır", () => {
    expect(settle(-70, 160, 80)).toBe("trailing");
    expect(settle(40, 160, 80)).toBe("leading");
  });

  it("hızlı fiske kısa mesafede de açar", () => {
    expect(settle(-20, 160, 80, -1.2)).toBe("trailing");
    expect(settle(10, 160, 80, 1.2)).toBe("leading");
  });

  it("olmayan tarafı açmaz", () => {
    expect(settle(-20, 0, 80)).toBeNull();
    expect(settle(60, 160, 0)).toBeNull();
    // Hız da olmayan paneli açamaz.
    expect(settle(10, 160, 0, 1.2)).toBeNull();
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
