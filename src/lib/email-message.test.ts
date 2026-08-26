import { describe, expect, it } from "vitest";
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  codeExpiry,
  generateCode,
  isValidCode,
  maintenanceMail,
  normalizeEmail,
  verificationMail,
  warrantyMail,
} from "./email-message";
import { planReminders } from "./reminders";
import { timeStatus, type MaintenanceRule } from "./maintenance";

const now = new Date(2026, 2, 14);

describe("generateCode / isValidCode", () => {
  it("altı hane üretir", () => {
    for (let i = 0; i < 30; i += 1) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isValidCode(code)).toBe(true);
    }
  });

  it("baştaki sıfırları korur", () => {
    expect(generateCode((bytes) => bytes.fill(7))).toBe("000007");
  });

  it("biçimsiz kodu reddeder", () => {
    expect(isValidCode("12345")).toBe(false);
    expect(isValidCode("abcdef")).toBe(false);
    expect(isValidCode("1234567")).toBe(false);
  });

  it("boşluklu kodu kabul eder — kullanıcı yapıştırırken alıyor", () => {
    expect(isValidCode(" 123456 ")).toBe(true);
  });
});

describe("codeExpiry", () => {
  it("15 dakika sonrası", () => {
    expect(codeExpiry(now).getTime() - now.getTime()).toBe(CODE_TTL_MINUTES * 60_000);
  });
});

describe("normalizeEmail", () => {
  it("küçültür ve kırpar", () => {
    expect(normalizeEmail("  Engin@Ornek.COM ")).toBe("engin@ornek.com");
  });

  it("biçimsizi reddeder", () => {
    expect(normalizeEmail("engin")).toBeNull();
    expect(normalizeEmail("engin@ornek")).toBeNull();
    expect(normalizeEmail("engin @ornek.com")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  it("çok uzunu reddeder", () => {
    expect(normalizeEmail(`${"a".repeat(200)}@ornek.com`)).toBeNull();
  });
});

describe("verificationMail", () => {
  it("kodu konuya ve gövdeye koyar", () => {
    const mail = verificationMail("123456");
    expect(mail.subject).toContain("123456");
    expect(mail.text).toContain("123456");
    expect(mail.text).toContain("15 dakika");
  });

  it("istenmeyen istekte ne yapılacağını söyler", () => {
    expect(verificationMail("123456").text).toContain("yok say");
  });
});

describe("warrantyMail", () => {
  const [reminder] = planReminders(
    [
      {
        itemId: "i1",
        itemName: "Çamaşır makinesi",
        locationId: "l1",
        warrantyEndDate: new Date(2026, 3, 13),
      },
    ],
    now,
  );

  it("kalan günü ve bağlantıyı yazar", () => {
    const mail = warrantyMail(reminder, "https://envanter.app");
    expect(mail.subject).toBe("Garanti bitiyor: Çamaşır makinesi");
    expect(mail.text).toContain("30 gün sonra bitiyor");
    expect(mail.text).toContain("https://envanter.app/envanter/i1");
  });

  it("taban adres yoksa göreli yol", () => {
    expect(warrantyMail(reminder, null).text).toContain("/envanter/i1");
  });

  it("bugün bitiyorsa ayrı cümle", () => {
    const [bugun] = planReminders(
      [
        {
          itemId: "i2",
          itemName: "Buzdolabı",
          locationId: "l1",
          warrantyEndDate: now,
        },
      ],
      now,
      [0],
    );
    expect(warrantyMail(bugun).text).toContain("bugün bitiyor");
  });
});

describe("maintenanceMail", () => {
  const rule: MaintenanceRule = {
    id: "r1",
    name: "Klima bakımı",
    everyMonths: 6,
    everyReading: null,
    readingUnit: null,
    leadDays: 7,
  };

  it("kural adını ve durumu yazar", () => {
    const status = timeStatus(rule, {
      // 14 Ağustos + 6 ay = 14 Şubat; bugün 14 Mart → gecikmiş.
      events: [{ kind: "SERVICE", date: new Date(2025, 7, 14), readingValue: null }],
      purchaseDate: null,
      now,
    });
    const mail = maintenanceMail({ id: "i1", name: "Salon klima" }, rule, status, "https://envanter.app");
    expect(mail.subject).toBe("Bakım zamanı: Salon klima");
    expect(mail.text).toContain("Klima bakımı");
    expect(mail.text).toContain("gün gecikti");
    expect(mail.text).toContain("https://envanter.app/envanter/i1");
  });
});
