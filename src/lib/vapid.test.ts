import { describe, expect, it } from "vitest";
import { isValidVapidSubject } from "./vapid";

describe("isValidVapidSubject", () => {
  it("mailto ve https kabul edilir", () => {
    expect(isValidVapidSubject("mailto:engin@ornek.com")).toBe(true);
    expect(isValidVapidSubject("  mailto:engin@ornek.com  ")).toBe(true);
    expect(isValidVapidSubject("https://envanter.app")).toBe(true);
  });

  it("etiket kabul edilmez — üretimde bunu gördük", () => {
    expect(isValidVapidSubject("Envanter_Test_Mail_Subject")).toBe(false);
  });

  it("eksik ya da bozuk adresler elenir", () => {
    expect(isValidVapidSubject("")).toBe(false);
    expect(isValidVapidSubject("engin@ornek.com")).toBe(false);
    expect(isValidVapidSubject("mailto:engin")).toBe(false);
    expect(isValidVapidSubject("http://envanter.app")).toBe(false);
  });
});
