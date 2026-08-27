import { describe, expect, it } from "vitest";
import { addMonths, parseDateOnly, toInputDate } from "./dates";

describe("addMonths", () => {
  it("normal ay ekler", () => {
    expect(toInputDate(addMonths(new Date(2026, 2, 14), 24))).toBe("2028-03-14");
  });

  it("ay sonunu taşırmaz", () => {
    expect(toInputDate(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(toInputDate(addMonths(new Date(2024, 0, 31), 1))).toBe("2024-02-29");
  });

  it("yıl sınırını geçer", () => {
    expect(toInputDate(addMonths(new Date(2026, 11, 15), 3))).toBe("2027-03-15");
  });
});

describe("parseDateOnly", () => {
  it("geçerli tarihi okur", () => {
    expect(toInputDate(parseDateOnly("2026-03-14"))).toBe("2026-03-14");
  });

  it("geçersizi null yapar", () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly("14.03.2026")).toBeNull();
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});
