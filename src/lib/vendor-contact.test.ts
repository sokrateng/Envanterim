import { describe, expect, it } from "vitest";
import { phoneHref, websiteHref, websiteLabel } from "@/lib/vendor-contact";

describe("websiteHref", () => {
  it("şema yazılmamışsa https ekler", () => {
    expect(websiteHref("bosch.com.tr")).toBe("https://bosch.com.tr/");
    expect(websiteHref("  www.vaillant.com.tr  ")).toBe(
      "https://www.vaillant.com.tr/",
    );
  });

  it("yazılan şemayı korur", () => {
    expect(websiteHref("http://servis.example.com/destek")).toBe(
      "http://servis.example.com/destek",
    );
  });

  it("http dışındaki şemayı bağlantıya çevirmez", () => {
    // Kullanıcının yazdığı metin doğrudan href olamaz.
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref("data:text/html,<script>")).toBeNull();
    expect(websiteHref("mailto:a@b.c")).toBeNull();
  });

  it("adrese benzemeyeni geri çevirir", () => {
    expect(websiteHref("bosch")).toBeNull();
    expect(websiteHref("")).toBeNull();
    expect(websiteHref(null)).toBeNull();
  });
});

describe("websiteLabel", () => {
  it("şemayı ve sondaki eğik çizgiyi atar", () => {
    expect(websiteLabel("https://bosch.com.tr/")).toBe("bosch.com.tr");
    expect(websiteLabel("servis.example.com/destek")).toBe(
      "servis.example.com/destek",
    );
  });
});

describe("phoneHref", () => {
  it("süsleri atar, artıyı korur", () => {
    expect(phoneHref("0850 111 22 33")).toBe("tel:08501112233");
    expect(phoneHref("+90 (212) 555 00 00")).toBe("tel:+902125550000");
  });

  it("telefon olamayacak kadar kısasını geri çevirir", () => {
    expect(phoneHref("123")).toBeNull();
    expect(phoneHref("dahili 4")).toBeNull();
    expect(phoneHref(null)).toBeNull();
  });
});
