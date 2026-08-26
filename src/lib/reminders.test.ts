import { describe, expect, it } from "vitest";
import {
  planReminders,
  reminderWindow,
  warrantyPushPayload,
  type ReminderTarget,
} from "./reminders";

const now = new Date(2026, 2, 14, 9, 30);

const gunSonra = (n: number) => {
  const date = new Date(2026, 2, 14);
  date.setDate(date.getDate() + n);
  return date;
};

const item = (over: Partial<ReminderTarget> = {}): ReminderTarget => ({
  itemId: "i1",
  itemName: "Çamaşır makinesi",
  locationId: "l1",
  warrantyEndDate: gunSonra(30),
  ...over,
});

describe("planReminders", () => {
  it("30 gün kala planlar", () => {
    const planned = planReminders([item()], now);
    expect(planned).toHaveLength(1);
    expect(planned[0].leadDays).toBe(30);
    expect(planned[0].daysLeft).toBe(30);
  });

  it("7 gün kala planlar", () => {
    const planned = planReminders([item({ warrantyEndDate: gunSonra(7) })], now);
    expect(planned[0]?.leadDays).toBe(7);
  });

  it("eşiğe denk gelmeyen günü atlar", () => {
    for (const gun of [31, 29, 8, 6, 1, 0]) {
      expect(planReminders([item({ warrantyEndDate: gunSonra(gun) })], now)).toEqual(
        [],
      );
    }
  });

  it("günün saati sonucu değiştirmez", () => {
    const gece = new Date(2026, 2, 14, 23, 59);
    const sabah = new Date(2026, 2, 14, 0, 1);
    expect(planReminders([item()], gece)).toHaveLength(1);
    expect(planReminders([item()], sabah)).toHaveLength(1);
  });

  it("garantisi geçmiş ürünü planlamaz", () => {
    expect(planReminders([item({ warrantyEndDate: gunSonra(-5) })], now)).toEqual([]);
  });

  it("birden çok üründen yalnız denk gelenleri seçer", () => {
    const planned = planReminders(
      [
        item({ itemId: "a", warrantyEndDate: gunSonra(30) }),
        item({ itemId: "b", warrantyEndDate: gunSonra(15) }),
        item({ itemId: "c", warrantyEndDate: gunSonra(7) }),
      ],
      now,
    );
    expect(planned.map((p) => p.itemId)).toEqual(["a", "c"]);
  });

  it("eşik listesi dışarıdan verilebilir", () => {
    const planned = planReminders([item({ warrantyEndDate: gunSonra(1) })], now, [1]);
    expect(planned[0]?.leadDays).toBe(1);
  });
});

describe("reminderWindow", () => {
  it("en yakın eşikten en uzağına kadar", () => {
    const { start, end } = reminderWindow(now);
    expect(start.getTime()).toBe(gunSonra(7).getTime());
    expect(end.getTime()).toBe(gunSonra(31).getTime());
  });

  it("pencere sorgusu planlanan ürünleri kapsıyor", () => {
    const { start, end } = reminderWindow(now);
    for (const gun of [7, 30]) {
      const tarih = gunSonra(gun);
      expect(tarih.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(tarih.getTime()).toBeLessThan(end.getTime());
    }
  });
});

describe("warrantyPushPayload", () => {
  it("kalan günü yazar", () => {
    const [planned] = planReminders([item()], now);
    const payload = warrantyPushPayload(planned);
    expect(payload.title).toBe("Garanti bitiyor");
    expect(payload.body).toBe("Çamaşır makinesi garantisi 30 gün sonra bitiyor.");
    expect(payload.url).toBe("/envanter/i1");
  });

  it("aynı ürün ve eşik için tek etiket", () => {
    const [planned] = planReminders([item()], now);
    expect(warrantyPushPayload(planned).tag).toBe("garanti-i1-30");
  });

  it("bugün bitiyorsa ayrı cümle", () => {
    const [planned] = planReminders([item({ warrantyEndDate: gunSonra(0) })], now, [0]);
    expect(warrantyPushPayload(planned).body).toBe(
      "Çamaşır makinesi garantisi bugün bitiyor.",
    );
  });
});
