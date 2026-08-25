import { describe, expect, it } from "vitest";
import {
  daysBetween,
  daysUntilWarrantyEnd,
  isReminderDue,
  startOfDay,
  warrantyStatus,
} from "./warranty";

/** Yerel saatle tarih üretir; testler saat dilimine göre kaymasın diye. */
const d = (y: number, m: number, day: number, hour = 0, min = 0) =>
  new Date(y, m - 1, day, hour, min);

describe("startOfDay", () => {
  it("saati sıfırlar", () => {
    expect(startOfDay(d(2026, 3, 14, 23, 59)).getTime()).toBe(
      d(2026, 3, 14).getTime(),
    );
  });
});

describe("daysBetween", () => {
  it("gün sınırını sayar, saati değil", () => {
    expect(daysBetween(d(2026, 3, 14, 23, 59), d(2026, 3, 15, 0, 1))).toBe(1);
    expect(daysBetween(d(2026, 3, 14, 0, 1), d(2026, 3, 14, 23, 59))).toBe(0);
  });

  it("geçmişe eksi döner", () => {
    expect(daysBetween(d(2026, 3, 15), d(2026, 3, 14))).toBe(-1);
  });

  it("yaz saati geçişinde tam gün verir", () => {
    // Avrupa/İstanbul'da kalıcı UTC+3 var; başka ortamlarda geçiş olsa bile
    // yuvarlama 23/25 saatlik günü tam güne indirir.
    expect(daysBetween(d(2026, 3, 28), d(2026, 3, 29))).toBe(1);
    expect(daysBetween(d(2026, 10, 24), d(2026, 10, 25))).toBe(1);
  });

  it("sıfırın işaretini sızdırmaz", () => {
    expect(Object.is(daysBetween(d(2026, 3, 14, 18), d(2026, 3, 14, 9)), 0)).toBe(
      true,
    );
  });
});

describe("daysUntilWarrantyEnd", () => {
  it("tarih yoksa null", () => {
    expect(daysUntilWarrantyEnd(null, d(2026, 3, 14))).toBeNull();
  });

  it("bugün biten garanti 0 gün", () => {
    expect(daysUntilWarrantyEnd(d(2026, 3, 14), d(2026, 3, 14, 22))).toBe(0);
  });

  it("dün biten garanti -1 gün", () => {
    expect(daysUntilWarrantyEnd(d(2026, 3, 13), d(2026, 3, 14, 1))).toBe(-1);
  });
});

describe("warrantyStatus", () => {
  const now = d(2026, 3, 14, 10);

  it("garanti bilgisi yoksa", () => {
    expect(warrantyStatus(undefined, now).state).toBe("none");
  });

  it("bitmişse gri rozet", () => {
    const s = warrantyStatus(d(2026, 3, 1), now);
    expect(s.state).toBe("expired");
    expect(s.label).toBe("Garanti bitti");
  });

  it("bugün bitiyorsa uyarı", () => {
    const s = warrantyStatus(d(2026, 3, 14, 3), now);
    expect(s.state).toBe("ending-soon");
    expect(s.label).toBe("Garanti bugün bitiyor");
  });

  it("30 gün ve altı yaklaşıyor sayılır", () => {
    expect(warrantyStatus(d(2026, 4, 13), now).state).toBe("ending-soon");
    expect(warrantyStatus(d(2026, 4, 14), now).state).toBe("active");
  });

  it("kalan günü yazar", () => {
    expect(warrantyStatus(d(2027, 3, 14), now).label).toBe("365 gün garanti");
  });
});

describe("isReminderDue", () => {
  const now = d(2026, 3, 14, 8);

  it("eşik gününde gönderilir", () => {
    expect(isReminderDue(d(2026, 4, 13), 30, now)).toBe(true);
  });

  it("eşikten önce gönderilmez", () => {
    expect(isReminderDue(d(2026, 4, 14), 30, now)).toBe(false);
  });

  it("tarih geçtiyse gönderilmez", () => {
    expect(isReminderDue(d(2026, 3, 13), 30, now)).toBe(false);
  });

  it("son gün hâlâ gönderilir", () => {
    expect(isReminderDue(d(2026, 3, 14, 23), 7, now)).toBe(true);
  });
});
