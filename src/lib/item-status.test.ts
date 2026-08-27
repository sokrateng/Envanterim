import { describe, expect, it } from "vitest";
import { statusView } from "@/lib/item-status";

describe("statusView", () => {
  it("durumu kendi etiketiyle ve tonuyla verir", () => {
    expect(statusView("IN_USE")).toEqual({ label: "Kullanımda", tone: "green" });
    expect(statusView("IN_REPAIR")).toEqual({ label: "Serviste", tone: "orange" });
    expect(statusView("RETIRED")).toEqual({ label: "Pasif", tone: "muted" });
    expect(statusView("SOLD")).toEqual({ label: "Satıldı", tone: "muted" });
  });

  it("kullanımdaki ekipman zimmetliyse onu gösterir", () => {
    expect(statusView("IN_USE", true)).toEqual({ label: "Zimmetli", tone: "blue" });
  });

  it("serviste olan ekipman zimmetli görünmez", () => {
    // Zimmet kaydı açık kalabilir; ekipman serviste ise cevabı bu olmalı.
    expect(statusView("IN_REPAIR", true)).toEqual({
      label: "Serviste",
      tone: "orange",
    });
    expect(statusView("RETIRED", true).label).toBe("Pasif");
  });
});
