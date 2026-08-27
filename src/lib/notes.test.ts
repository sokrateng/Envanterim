import { describe, expect, it } from "vitest";
import { canDeleteNote, canEditNote, noteExcerpt } from "@/lib/notes";

const yazar = { userId: "u1" };

describe("canEditNote", () => {
  it("yalnız yazarı düzenler", () => {
    expect(canEditNote(yazar, { userId: "u1", role: "EDITOR" })).toBe(true);
    expect(canEditNote(yazar, { userId: "u2", role: "OWNER" })).toBe(false);
  });

  it("yazarı silinmiş notu kimse düzenleyemez", () => {
    expect(canEditNote({ userId: null }, { userId: "u1", role: "OWNER" })).toBe(false);
  });
});

describe("canDeleteNote", () => {
  it("yazarı ve lokasyon sahibi silebilir", () => {
    expect(canDeleteNote(yazar, { userId: "u1", role: "VIEWER" })).toBe(true);
    expect(canDeleteNote(yazar, { userId: "u2", role: "OWNER" })).toBe(true);
    expect(canDeleteNote(yazar, { userId: "u2", role: "EDITOR" })).toBe(false);
  });
});

describe("noteExcerpt", () => {
  it("kısa notu olduğu gibi verir, boşlukları toplar", () => {
    expect(noteExcerpt("  İki   satır\nolmuş ")).toBe("İki satır olmuş");
  });

  it("uzun notu keser", () => {
    const uzun = "a".repeat(200);
    const kisa = noteExcerpt(uzun, 20);
    expect(kisa).toHaveLength(20);
    expect(kisa.endsWith("…")).toBe(true);
  });
});
