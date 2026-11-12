import { describe, expect, it } from "vitest";
import { normalizeVapidSubject } from "./vapid";

describe("normalizeVapidSubject", () => {
  it("düz e-postaya mailto: ekler", () => {
    expect(normalizeVapidSubject("ben@ornek.com")).toBe("mailto:ben@ornek.com");
  });

  it("zaten mailto: ya da https:// ise dokunmaz", () => {
    expect(normalizeVapidSubject("mailto:ben@ornek.com")).toBe("mailto:ben@ornek.com");
    expect(normalizeVapidSubject("https://ornek.com/iletisim")).toBe(
      "https://ornek.com/iletisim",
    );
  });

  it("baştaki ve sondaki boşluğu atar", () => {
    expect(normalizeVapidSubject("  ben@ornek.com ")).toBe("mailto:ben@ornek.com");
  });

  it("adres olmayanı reddeder", () => {
    expect(normalizeVapidSubject("")).toBeNull();
    expect(normalizeVapidSubject("Engin Çoban")).toBeNull();
    expect(normalizeVapidSubject("http://ornek.com")).toBeNull();
    expect(normalizeVapidSubject("ben@ornek")).toBeNull();
  });
});
