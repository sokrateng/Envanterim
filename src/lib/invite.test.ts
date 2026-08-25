import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_LENGTH,
  generateInviteCode,
  inviteExpiry,
  inviteState,
  normalizeInviteCode,
} from "./invite";

describe("generateInviteCode", () => {
  it("sabit uzunlukta ve karışan harfsiz üretir", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  it("verilen rastgeleliği kullanır", () => {
    expect(generateInviteCode(() => 0)).toBe("AAAAAAAAAA");
  });
});

describe("normalizeInviteCode", () => {
  it("küçük harfi, tireyi ve boşluğu temizler", () => {
    expect(normalizeInviteCode(" abc-def ghj ")).toBe("ABCDEFGHJ");
  });

  it("boş girdiyi boş bırakır", () => {
    expect(normalizeInviteCode("---")).toBe("");
  });
});

describe("inviteState", () => {
  const now = new Date(2026, 2, 14, 12);

  it("kullanılmışsa used", () => {
    expect(
      inviteState({ expiresAt: new Date(2026, 2, 20), usedAt: new Date(2026, 2, 15) }, now),
    ).toBe("used");
  });

  it("süresi geçmişse expired", () => {
    expect(
      inviteState({ expiresAt: new Date(2026, 2, 14, 11, 59), usedAt: null }, now),
    ).toBe("expired");
  });

  it("tam sınırda expired", () => {
    expect(inviteState({ expiresAt: now, usedAt: null }, now)).toBe("expired");
  });

  it("süresi dolmamışsa valid", () => {
    expect(
      inviteState({ expiresAt: new Date(2026, 2, 14, 12, 1), usedAt: null }, now),
    ).toBe("valid");
  });

  it("kullanılmışsa süresi dolmamış olsa da used", () => {
    expect(
      inviteState({ expiresAt: new Date(2027, 0, 1), usedAt: new Date(2026, 2, 1) }, now),
    ).toBe("used");
  });
});

describe("inviteExpiry", () => {
  it("varsayılan 7 gün sonrası", () => {
    const now = new Date(2026, 2, 14, 12);
    expect(inviteExpiry(now).getTime() - now.getTime()).toBe(7 * 86_400_000);
  });
});
