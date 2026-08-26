import { describe, expect, it } from "vitest";
import {
  baseReading,
  lastServiceDate,
  latestReadingValue,
  maintenancePushBody,
  readingStatus,
  ruleStatus,
  statusText,
  timeStatus,
  type MaintenanceRule,
} from "./maintenance";
import type { TimelineEvent } from "./events";

const now = new Date(2026, 5, 14);

const rule = (over: Partial<MaintenanceRule> = {}): MaintenanceRule => ({
  id: "r1",
  name: "Klima bakımı",
  everyMonths: null,
  everyReading: null,
  readingUnit: null,
  leadDays: 7,
  ...over,
});

type Event = Pick<TimelineEvent, "kind" | "date" | "readingValue">;

const servis = (date: Date): Event => ({ kind: "SERVICE", date, readingValue: null });
const okuma = (date: Date, readingValue: number): Event => ({
  kind: "READING",
  date,
  readingValue,
});

describe("lastServiceDate", () => {
  it("en yeni servisi verir", () => {
    const date = lastServiceDate([
      servis(new Date(2026, 0, 1)),
      servis(new Date(2026, 3, 1)),
      okuma(new Date(2026, 4, 1), 100),
    ]);
    expect(date?.getMonth()).toBe(3);
  });

  it("servis yoksa null", () => {
    expect(lastServiceDate([okuma(new Date(2026, 0, 1), 10)])).toBeNull();
  });
});

describe("baseReading / latestReadingValue", () => {
  const events = [
    okuma(new Date(2026, 0, 1), 100000),
    servis(new Date(2026, 1, 1)),
    okuma(new Date(2026, 1, 1), 110000),
    okuma(new Date(2026, 4, 1), 128500),
  ];

  it("son servis anındaki okumayı taban alır", () => {
    expect(baseReading(events)).toBe(110000);
  });

  it("servis yoksa en eski okumayı taban alır", () => {
    expect(baseReading([events[0], events[3]])).toBe(100000);
  });

  it("okuma yoksa null", () => {
    expect(baseReading([servis(new Date(2026, 1, 1))])).toBeNull();
  });

  it("en yeni okumayı verir", () => {
    expect(latestReadingValue(events)).toBe(128500);
  });
});

describe("timeStatus", () => {
  const aylik = rule({ everyMonths: 6 });

  it("son servisten itibaren sayar", () => {
    const status = timeStatus(aylik, {
      events: [servis(new Date(2026, 0, 14))],
      purchaseDate: new Date(2020, 0, 1),
      now,
    });
    expect(status.dueDate?.getMonth()).toBe(6);
    expect(status.daysLeft).toBe(30);
    expect(status.state).toBe("ok");
  });

  it("servis yoksa alış tarihinden sayar", () => {
    const status = timeStatus(aylik, {
      events: [],
      purchaseDate: new Date(2026, 0, 14),
      now,
    });
    expect(status.since?.getMonth()).toBe(0);
    expect(status.state).toBe("ok");
  });

  it("eşiğe girince yaklaşıyor der", () => {
    // 20 Aralık + 6 ay = 20 Haziran; bugün 14 Haziran → 6 gün kaldı.
    const status = timeStatus(aylik, {
      events: [servis(new Date(2025, 11, 20))],
      purchaseDate: null,
      now,
    });
    expect(status.daysLeft).toBe(6);
    expect(status.state).toBe("soon");
  });

  it("tarih geçtiyse gecikmiş sayar", () => {
    const status = timeStatus(aylik, {
      events: [servis(new Date(2025, 10, 1))],
      purchaseDate: null,
      now,
    });
    expect(status.state).toBe("due");
    expect(status.daysLeft).toBeLessThan(0);
  });

  it("başlangıç yoksa bilinmiyor", () => {
    const status = timeStatus(aylik, { events: [], purchaseDate: null, now });
    expect(status.state).toBe("unknown");
    expect(status.dueDate).toBeNull();
  });
});

describe("readingStatus", () => {
  const kmKurali = rule({ everyReading: 10000, readingUnit: "km" });

  it("son servisteki okumadan itibaren sayar", () => {
    const status = readingStatus(kmKurali, {
      events: [
        okuma(new Date(2026, 0, 1), 100000),
        servis(new Date(2026, 1, 1)),
        okuma(new Date(2026, 1, 1), 110000),
        okuma(new Date(2026, 4, 1), 115000),
      ],
    });
    expect(status.dueAt).toBe(120000);
    expect(status.remaining).toBe(5000);
    expect(status.state).toBe("ok");
    expect(status.cycle).toBe(0);
  });

  it("son %10'a girince yaklaşıyor der", () => {
    const status = readingStatus(kmKurali, {
      events: [okuma(new Date(2026, 0, 1), 100000), okuma(new Date(2026, 4, 1), 109500)],
    });
    expect(status.state).toBe("soon");
    expect(status.remaining).toBe(500);
  });

  it("aşıldıysa gecikmiş sayar ve turu sayar", () => {
    const status = readingStatus(kmKurali, {
      events: [okuma(new Date(2026, 0, 1), 100000), okuma(new Date(2026, 4, 1), 125000)],
    });
    expect(status.state).toBe("due");
    expect(status.remaining).toBe(-15000);
    expect(status.cycle).toBe(2);
  });

  it("okuma yoksa bilinmiyor", () => {
    expect(readingStatus(kmKurali, { events: [] }).state).toBe("unknown");
  });

  it("kural sıfır ya da eksiyse bilinmiyor", () => {
    const bozuk = rule({ everyReading: 0 });
    expect(readingStatus(bozuk, { events: [okuma(new Date(), 10)] }).state).toBe(
      "unknown",
    );
  });
});

describe("ruleStatus", () => {
  it("sayaç kuralı varsa sayaca bakar", () => {
    const status = ruleStatus(rule({ everyMonths: 6, everyReading: 10000 }), {
      events: [okuma(new Date(2026, 0, 1), 100000)],
      purchaseDate: new Date(2020, 0, 1),
      now,
    });
    expect(status.kind).toBe("reading");
  });

  it("yalnız ay varsa zamana bakar", () => {
    const status = ruleStatus(rule({ everyMonths: 6 }), {
      events: [],
      purchaseDate: new Date(2026, 0, 1),
      now,
    });
    expect(status.kind).toBe("time");
  });
});

describe("statusText", () => {
  it("kalan günü yazar", () => {
    const kural = rule({ everyMonths: 6 });
    const status = timeStatus(kural, {
      events: [servis(new Date(2026, 0, 14))],
      purchaseDate: null,
      now,
    });
    expect(statusText(kural, status)).toBe("30 gün kaldı");
  });

  it("gecikmeyi yazar", () => {
    const kural = rule({ everyMonths: 1 });
    const status = timeStatus(kural, {
      events: [servis(new Date(2026, 3, 14))],
      purchaseDate: null,
      now,
    });
    expect(statusText(kural, status)).toBe("31 gün gecikti");
  });

  it("sayaç için birimle yazar", () => {
    const kural = rule({ everyReading: 10000, readingUnit: "km" });
    const status = readingStatus(kural, {
      events: [okuma(new Date(2026, 0, 1), 100000), okuma(new Date(2026, 4, 1), 115000)],
    });
    expect(statusText(kural, status)).toBe("5.000 km geçildi");
  });

  it("eksik veriyi anlaşılır anlatır", () => {
    const kural = rule({ everyReading: 10000 });
    expect(statusText(kural, readingStatus(kural, { events: [] }))).toContain(
      "Sayaç okuması yok",
    );
  });
});

describe("maintenancePushBody", () => {
  it("bildirim cümlesi kurar", () => {
    const kural = rule({ everyMonths: 6, name: "Klima bakımı" });
    const status = timeStatus(kural, {
      events: [servis(new Date(2025, 11, 14))],
      purchaseDate: null,
      now,
    });
    expect(maintenancePushBody("Salon klima", kural, status)).toBe(
      "Salon klima: Klima bakımı — bugün yapılmalı.",
    );
  });
});
