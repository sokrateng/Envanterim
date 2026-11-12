import { describe, expect, it } from "vitest";
import {
  clientAddress,
  createFailureLimiter,
  startLoginAttempt,
} from "./login-limit";

const RULE = { maxFailures: 3, windowMs: 1000, lockMs: 5000 };

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createFailureLimiter", () => {
  it("sınıra kadar engellemez", () => {
    const c = clock();
    const limiter = createFailureLimiter(RULE, c.now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.isBlocked("a")).toBe(false);
  });

  it("sınır aşılınca kilitler, kilit süresi dolunca açar", () => {
    const c = clock();
    const limiter = createFailureLimiter(RULE, c.now);
    for (let i = 0; i < 3; i += 1) limiter.recordFailure("a");
    expect(limiter.isBlocked("a")).toBe(true);
    c.advance(4999);
    expect(limiter.isBlocked("a")).toBe(true);
    c.advance(2);
    expect(limiter.isBlocked("a")).toBe(false);
  });

  it("pencere dışında kalan başarısızlıkları saymaz", () => {
    const c = clock();
    const limiter = createFailureLimiter(RULE, c.now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    c.advance(1500);
    limiter.recordFailure("a");
    expect(limiter.isBlocked("a")).toBe(false);
  });

  it("başarılı giriş sayacı sıfırlar", () => {
    const c = clock();
    const limiter = createFailureLimiter(RULE, c.now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    limiter.recordSuccess("a");
    limiter.recordFailure("a");
    expect(limiter.isBlocked("a")).toBe(false);
  });

  it("anahtarlar birbirinden bağımsız", () => {
    const c = clock();
    const limiter = createFailureLimiter(RULE, c.now);
    for (let i = 0; i < 3; i += 1) limiter.recordFailure("a");
    expect(limiter.isBlocked("b")).toBe(false);
  });

  it("süren denemeler de sınıra sayılır (eşzamanlı istek seli)", () => {
    const c = clock();
    const limiter = createFailureLimiter(RULE, c.now);
    limiter.begin("a");
    limiter.begin("a");
    expect(limiter.isBlocked("a")).toBe(false);
    limiter.begin("a");
    expect(limiter.isBlocked("a")).toBe(true);
    limiter.end("a");
    expect(limiter.isBlocked("a")).toBe(false);
  });
});

describe("startLoginAttempt", () => {
  it("aynı anda başlatılan denemelerden yalnız ilk beşi geçer", () => {
    const user = "esz-kullanici";
    const address = "10.0.0.1";
    const attempts = Array.from({ length: 10 }, () =>
      startLoginAttempt(user, address),
    );
    expect(attempts.filter((a) => a !== null)).toHaveLength(5);
    attempts.forEach((a) => a?.fail());
  });

  it("5 başarısızdan sonra aynı çift kilitli, başka adres değil", () => {
    const user = "kilit-kullanici";
    for (let i = 0; i < 5; i += 1) startLoginAttempt(user, "10.0.0.2")?.fail();
    expect(startLoginAttempt(user, "10.0.0.2")).toBeNull();
    const other = startLoginAttempt(user, "10.0.0.3");
    expect(other).not.toBeNull();
    other?.succeed();
  });

  it("başarılı giriş kullanıcı+adres sayacını sıfırlar", () => {
    const user = "basari-kullanici";
    for (let i = 0; i < 4; i += 1) startLoginAttempt(user, "10.0.0.4")?.fail();
    startLoginAttempt(user, "10.0.0.4")?.succeed();
    for (let i = 0; i < 4; i += 1) startLoginAttempt(user, "10.0.0.4")?.fail();
    const next = startLoginAttempt(user, "10.0.0.4");
    expect(next).not.toBeNull();
    next?.succeed();
  });

  it("aynı denemeyi iki kez kapatmak sayacı bozmaz", () => {
    const attempt = startLoginAttempt("cift-kapama", "10.0.0.5");
    attempt?.fail();
    attempt?.fail();
    attempt?.succeed();
    const again = startLoginAttempt("cift-kapama", "10.0.0.5");
    expect(again).not.toBeNull();
    again?.succeed();
  });
});

describe("clientAddress", () => {
  it("X-Forwarded-For'un son değerini alır, baştakilere güvenmez", () => {
    expect(
      clientAddress({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }),
    ).toBe("3.3.3.3");
  });

  it("başlık yoksa x-real-ip'e düşer", () => {
    expect(clientAddress({ "x-real-ip": "9.9.9.9" })).toBe("9.9.9.9");
  });

  it("hiçbiri yoksa sabit bir değer döner", () => {
    expect(clientAddress({})).toBe("bilinmiyor");
    expect(clientAddress(undefined)).toBe("bilinmiyor");
  });
});
