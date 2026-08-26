import { describe, expect, it } from "vitest";
import {
  SHARE_TOKEN_LENGTH,
  expiryFromNow,
  generateToken,
  isValidDuration,
  isValidToken,
  remainingText,
  shareState,
  shareUrl,
} from "./share";

const now = new Date(2026, 2, 14, 12);
const saatSonra = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe("generateToken / isValidToken", () => {
  it("sabit uzunlukta onaltılık üretir", () => {
    for (let i = 0; i < 20; i += 1) {
      const token = generateToken();
      expect(token).toHaveLength(SHARE_TOKEN_LENGTH);
      expect(isValidToken(token)).toBe(true);
    }
  });

  it("verilen rastgeleliği kullanır", () => {
    expect(generateToken((bytes) => bytes.fill(0))).toBe("0".repeat(SHARE_TOKEN_LENGTH));
    expect(generateToken((bytes) => bytes.fill(255))).toBe("f".repeat(SHARE_TOKEN_LENGTH));
  });

  it("iki üretim aynı çıkmaz", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it("biçimsiz anahtarı reddeder", () => {
    expect(isValidToken("kısa")).toBe(false);
    expect(isValidToken("Z".repeat(SHARE_TOKEN_LENGTH))).toBe(false);
    expect(isValidToken("a".repeat(SHARE_TOKEN_LENGTH + 1))).toBe(false);
  });
});

describe("isValidDuration", () => {
  it("yalnız tanımlı süreleri kabul eder", () => {
    expect(isValidDuration(7)).toBe(true);
    expect(isValidDuration(3)).toBe(false);
    expect(isValidDuration(3650)).toBe(false);
  });
});

describe("expiryFromNow", () => {
  it("gün ekler", () => {
    expect(expiryFromNow(7, now).getTime() - now.getTime()).toBe(7 * 86_400_000);
  });
});

describe("shareState", () => {
  it("süresi dolmamış ve iptal edilmemişse geçerli", () => {
    expect(shareState({ expiresAt: saatSonra(1), revokedAt: null }, now)).toBe("valid");
  });

  it("süresi dolmuşsa expired", () => {
    expect(shareState({ expiresAt: saatSonra(-1), revokedAt: null }, now)).toBe("expired");
  });

  it("tam sınırda expired", () => {
    expect(shareState({ expiresAt: now, revokedAt: null }, now)).toBe("expired");
  });

  it("iptal, süreden önce gelir", () => {
    expect(
      shareState({ expiresAt: saatSonra(100), revokedAt: saatSonra(-1) }, now),
    ).toBe("revoked");
  });
});

describe("shareUrl", () => {
  it("tam adres kurar", () => {
    expect(shareUrl("https://envanter.app/", "abc")).toBe("https://envanter.app/p/abc");
  });

  it("taban yoksa göreli yol", () => {
    expect(shareUrl("", "abc")).toBe("/p/abc");
  });
});

describe("remainingText", () => {
  it("gün olarak yazar", () => {
    expect(remainingText({ expiresAt: saatSonra(48), revokedAt: null }, now)).toBe(
      "2 gün kaldı",
    );
  });

  it("bir günden azını saatle yazar", () => {
    expect(remainingText({ expiresAt: saatSonra(5), revokedAt: null }, now)).toBe(
      "5 saat kaldı",
    );
  });

  it("son saatte ayrı cümle", () => {
    expect(remainingText({ expiresAt: saatSonra(0.5), revokedAt: null }, now)).toBe(
      "1 saatten az kaldı",
    );
  });

  it("geçersizse durumunu yazar", () => {
    expect(remainingText({ expiresAt: saatSonra(-1), revokedAt: null }, now)).toBe(
      "Süresi doldu",
    );
    expect(
      remainingText({ expiresAt: saatSonra(10), revokedAt: saatSonra(-1) }, now),
    ).toBe("İptal edildi");
  });
});
