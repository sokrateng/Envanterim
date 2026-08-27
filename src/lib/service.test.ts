import { describe, expect, it } from "vitest";
import {
  daysAtService,
  hasOpenJob,
  paymentLabel,
  serviceCostMinor,
  serviceLabel,
  serviceState,
  statusAfterService,
} from "@/lib/service";

const gun = (n: number) => new Date(2026, 2, n);

describe("serviceState", () => {
  it("dönüş tarihi yoksa açık", () => {
    expect(serviceState({ returnedAt: null })).toBe("open");
    expect(serviceState({ returnedAt: gun(10) })).toBe("closed");
  });
});

describe("daysAtService", () => {
  it("açık işte bugüne kadar sayar", () => {
    expect(daysAtService({ sentAt: gun(1), returnedAt: null }, gun(9))).toBe(8);
  });

  it("kapalı işte dönüş gününe kadar sayar", () => {
    expect(daysAtService({ sentAt: gun(1), returnedAt: gun(4) }, gun(20))).toBe(3);
  });

  it("gelecek tarihli gönderimde eksi gün olmaz", () => {
    expect(daysAtService({ sentAt: gun(10), returnedAt: null }, gun(2))).toBe(0);
  });
});

describe("serviceLabel", () => {
  it("açık ve kapalı iş için ayrı metin", () => {
    expect(serviceLabel({ sentAt: gun(1), returnedAt: null }, gun(4))).toBe(
      "3 gündür serviste",
    );
    expect(serviceLabel({ sentAt: gun(1), returnedAt: null }, gun(1))).toBe(
      "Bugün gönderildi",
    );
    expect(serviceLabel({ sentAt: gun(1), returnedAt: gun(5) })).toBe("4 günde döndü");
    expect(serviceLabel({ sentAt: gun(1), returnedAt: gun(1) })).toBe("Aynı gün döndü");
  });
});

describe("paymentLabel", () => {
  const acik = { returnedAt: null, costMinor: null, paid: false, underWarranty: false };

  it("garanti kapsamında ücret sorulmuyor", () => {
    expect(paymentLabel({ ...acik, underWarranty: true })).toBe("Garanti kapsamında");
  });

  it("açık işte ücret yoksa bir şey demiyor", () => {
    expect(paymentLabel(acik)).toBeNull();
  });

  it("dönen işte ücret girilmediyse söylüyor", () => {
    expect(paymentLabel({ ...acik, returnedAt: gun(5) })).toBe("Ücret girilmedi");
  });

  it("ödendi ve ödenmedi ayrı", () => {
    expect(paymentLabel({ ...acik, costMinor: 50000, paid: true })).toBe("Ödendi");
    expect(paymentLabel({ ...acik, costMinor: 50000, paid: false })).toBe("Ödenmedi");
  });
});

describe("serviceCostMinor", () => {
  it("garanti kapsamındaki iş maliyete girmiyor", () => {
    expect(
      serviceCostMinor([
        { costMinor: 50000, underWarranty: false },
        { costMinor: 120000, underWarranty: true },
        { costMinor: null, underWarranty: false },
      ]),
    ).toBe(50000);
  });
});

describe("statusAfterService", () => {
  it("açık iş varken serviste kalır", () => {
    expect(statusAfterService("IN_USE", [{ returnedAt: null }])).toBe("IN_REPAIR");
  });

  it("hepsi kapanınca kullanıma döner", () => {
    expect(statusAfterService("IN_REPAIR", [{ returnedAt: gun(3) }])).toBe("IN_USE");
    expect(statusAfterService("IN_REPAIR", [])).toBe("IN_USE");
  });

  it("pasif ve satılmış ekipman kullanıma dönmez", () => {
    expect(statusAfterService("RETIRED", [{ returnedAt: null }])).toBe("RETIRED");
    expect(statusAfterService("SOLD", [{ returnedAt: gun(3) }])).toBe("SOLD");
  });
});

describe("hasOpenJob", () => {
  it("açık iş varlığını söyler", () => {
    expect(hasOpenJob([{ returnedAt: gun(1) }, { returnedAt: null }])).toBe(true);
    expect(hasOpenJob([{ returnedAt: gun(1) }])).toBe(false);
  });
});
