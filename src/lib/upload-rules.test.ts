import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  checkUpload,
  isAllowedType,
  isImage,
  safeDisplayName,
  storagePath,
} from "./upload-rules";

const KINDS = ["PHOTO", "INVOICE", "WARRANTY", "MANUAL", "OTHER"] as const;

describe("isAllowedType / isImage", () => {
  it("izinli türleri tanır", () => {
    expect(isAllowedType("image/jpeg")).toBe(true);
    expect(isAllowedType("application/pdf")).toBe(true);
    expect(isAllowedType("text/html")).toBe(false);
    expect(isAllowedType("")).toBe(false);
  });

  it("PDF görsel değildir", () => {
    expect(isImage("image/png")).toBe(true);
    expect(isImage("application/pdf")).toBe(false);
  });
});

describe("checkUpload", () => {
  const pdf = { type: "application/pdf", size: 1000 };
  const jpg = { type: "image/jpeg", size: 1000 };

  it("geçerli yüklemeyi kabul eder", () => {
    expect(checkUpload(jpg, "PHOTO", KINDS)).toEqual({ ok: true, kind: "PHOTO" });
    expect(checkUpload(pdf, "INVOICE", KINDS)).toEqual({ ok: true, kind: "INVOICE" });
  });

  it("izinsiz türü reddeder", () => {
    expect(checkUpload({ type: "text/html", size: 10 }, "OTHER", KINDS).ok).toBe(false);
  });

  it("boş ve büyük dosyayı reddeder", () => {
    expect(checkUpload({ ...jpg, size: 0 }, "PHOTO", KINDS).ok).toBe(false);
    expect(checkUpload({ ...jpg, size: MAX_UPLOAD_BYTES + 1 }, "PHOTO", KINDS).ok).toBe(false);
    expect(checkUpload({ ...jpg, size: MAX_UPLOAD_BYTES }, "PHOTO", KINDS).ok).toBe(true);
  });

  it("PDF'i fotoğraf olarak kabul etmez", () => {
    const result = checkUpload(pdf, "PHOTO", KINDS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Fotoğraf olarak yalnız görsel yüklenir");
    }
  });

  it("bilinmeyen belge türünü reddeder", () => {
    expect(checkUpload(pdf, "FATURA", KINDS).ok).toBe(false);
  });
});

describe("storagePath", () => {
  it("uzantıyı MIME'dan alır", () => {
    expect(storagePath("i1", "f1", "image/jpeg")).toBe("ekipman/i1/f1.jpg");
    expect(storagePath("i1", "f1", "application/pdf")).toBe("ekipman/i1/f1.pdf");
  });

  it("bilinmeyen MIME'da bin uzantısı", () => {
    expect(storagePath("i1", "f1", "application/zip")).toBe("ekipman/i1/f1.bin");
  });
});

describe("safeDisplayName", () => {
  it("yol ayracını boşluğa çevirir", () => {
    expect(safeDisplayName("../../etc/passwd")).toBe(".. .. etc passwd");
  });

  it("boş adı yedeğe düşürür", () => {
    expect(safeDisplayName("   ")).toBe("dosya");
    expect(safeDisplayName("///")).toBe("dosya");
  });

  it("uzun adı kırpar", () => {
    expect(safeDisplayName("a".repeat(200))).toHaveLength(80);
  });
});
