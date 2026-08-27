import { describe, expect, it } from "vitest";
import {
  countByKind,
  eventSummary,
  filterByKind,
  latestReading,
  ownershipCostMinor,
  sortTimeline,
  type TimelineEvent,
} from "./events";

const event = (over: Partial<TimelineEvent> & Pick<TimelineEvent, "kind">): TimelineEvent => ({
  id: Math.random().toString(36).slice(2),
  date: new Date(2026, 2, 14),
  note: null,
  costMinor: null,
  readingValue: null,
  readingUnit: null,
  vendorName: null,
  assignedToName: null,
  assignedPlace: null,
  ...over,
});

describe("eventSummary", () => {
  it("servis: firma ve tutar", () => {
    expect(
      eventSummary(
        event({ kind: "SERVICE", vendorName: "Bosch Servis", costMinor: 185000 }),
      ),
    ).toBe("Bosch Servis · 1.850,00 ₺");
  });

  it("servis: tutar yoksa yazmaz", () => {
    expect(eventSummary(event({ kind: "SERVICE", vendorName: "Arçelik" }))).toBe(
      "Arçelik",
    );
  });

  it("sayaç: değer ve birim", () => {
    expect(
      eventSummary(
        event({ kind: "READING", readingValue: 128500, readingUnit: "km" }),
      ),
    ).toBe("128.500 km");
  });

  it("zimmet: kişi ve yer", () => {
    expect(
      eventSummary(
        event({ kind: "ASSIGNMENT", assignedToName: "Buket C", assignedPlace: "Şantiye" }),
      ),
    ).toBe("Buket C · Şantiye");
  });

  it("günlük: yalnız not", () => {
    expect(eventSummary(event({ kind: "LOG", note: "Pil değişti" }))).toBe(
      "Pil değişti",
    );
  });

  it("not her türde sona eklenir", () => {
    expect(
      eventSummary(
        event({ kind: "SERVICE", vendorName: "Servis", note: "Pompa değişti" }),
      ),
    ).toBe("Servis · Pompa değişti");
  });

  it("hiçbir alan yoksa boş döner", () => {
    expect(eventSummary(event({ kind: "LOG" }))).toBe("");
  });

  it("para birimini kullanır", () => {
    expect(
      eventSummary(event({ kind: "SERVICE", costMinor: 5000 }), "USD"),
    ).toBe("50,00 $");
  });
});

describe("ownershipCostMinor", () => {
  it("alış + servis toplamı", () => {
    const total = ownershipCostMinor(1840050, [
      event({ kind: "SERVICE", costMinor: 185000 }),
      event({ kind: "SERVICE", costMinor: 42000 }),
      event({ kind: "LOG", costMinor: 999999 }), // servis değil, sayılmaz
    ]);
    expect(total).toBe(1840050 + 185000 + 42000);
  });

  it("yedek parçaları da ekler", () => {
    expect(ownershipCostMinor(1000, [], [500, null, 250])).toBe(1750);
  });

  it("alış tutarı yoksa yalnız giderleri toplar", () => {
    expect(ownershipCostMinor(null, [event({ kind: "SERVICE", costMinor: 100 })])).toBe(
      100,
    );
  });

  it("hiçbir şey yoksa sıfır", () => {
    expect(ownershipCostMinor(undefined, [])).toBe(0);
  });
});

describe("latestReading", () => {
  it("en yeni okumayı verir", () => {
    const reading = latestReading([
      event({ kind: "READING", readingValue: 100, readingUnit: "km", date: new Date(2026, 0, 1) }),
      event({ kind: "READING", readingValue: 250, readingUnit: "km", date: new Date(2026, 5, 1) }),
      event({ kind: "SERVICE", date: new Date(2026, 6, 1) }),
    ]);
    expect(reading?.value).toBe(250);
    expect(reading?.unit).toBe("km");
  });

  it("okuma yoksa null", () => {
    expect(latestReading([event({ kind: "LOG" })])).toBeNull();
  });

  it("değeri boş okumayı saymaz", () => {
    expect(latestReading([event({ kind: "READING", readingValue: null })])).toBeNull();
  });
});

describe("sortTimeline / filterByKind / countByKind", () => {
  const events = [
    event({ kind: "LOG", date: new Date(2026, 0, 1) }),
    event({ kind: "SERVICE", date: new Date(2026, 5, 1) }),
    event({ kind: "SERVICE", date: new Date(2026, 2, 1) }),
  ];

  it("en yeni üstte sıralar ve girdiyi bozmaz", () => {
    const sorted = sortTimeline(events);
    expect(sorted.map((e) => e.date.getMonth())).toEqual([5, 2, 0]);
    expect(events[0].date.getMonth()).toBe(0);
  });

  it("türe göre filtreler", () => {
    expect(filterByKind(events, "SERVICE")).toHaveLength(2);
    expect(filterByKind(events, null)).toHaveLength(3);
  });

  it("türleri sayar", () => {
    expect(countByKind(events)).toEqual({
      SERVICE: 2,
      READING: 0,
      LOG: 1,
      ASSIGNMENT: 0,
    });
  });
});

describe("ownershipCostMinor · yetkili servis", () => {
  it("servis kaydının ücreti de toplama giriyor", () => {
    expect(ownershipCostMinor(1000, [], [], [500, null])).toBe(1500);
  });
});
