import { describe, expect, it } from "vitest";
import {
  buildCustomFieldsSchema,
  keyFromLabel,
  mergeCustomFields,
  readCustomFields,
  visibleFields,
  type FieldDef,
} from "./custom-fields";

const field = (over: Partial<FieldDef> & Pick<FieldDef, "key" | "type">): FieldDef => ({
  label: over.key,
  required: false,
  ...over,
});

describe("buildCustomFieldsSchema — TEXT", () => {
  const schema = buildCustomFieldsSchema([
    field({ key: "renk", label: "Renk", type: "TEXT" }),
    field({ key: "not", label: "Not", type: "TEXT", required: true }),
  ]);

  it("boş isteğe bağlı alanı düşürür", () => {
    const result = schema.parse({ renk: "", not: "acil" });
    expect(result).toEqual({ not: "acil" });
  });

  it("zorunlu alan boşsa Türkçe hata verir", () => {
    const result = schema.safeParse({ not: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Not gerekli");
  });

  it("baştaki ve sondaki boşluğu kırpar", () => {
    expect(schema.parse({ renk: " mavi ", not: "x" }).renk).toBe("mavi");
  });
});

describe("buildCustomFieldsSchema — NUMBER", () => {
  const schema = buildCustomFieldsSchema([
    field({ key: "kapasite", label: "Kapasite", type: "NUMBER", required: true }),
  ]);

  it("Türkçe ondalık metni sayıya çevirir", () => {
    expect(schema.parse({ kapasite: "1.234,5" }).kapasite).toBe(1234.5);
  });

  it("sayıyı olduğu gibi alır", () => {
    expect(schema.parse({ kapasite: 8 }).kapasite).toBe(8);
  });

  it("sayı olmayanı reddeder", () => {
    const result = schema.safeParse({ kapasite: "sekiz" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Kapasite sayı olmalı");
  });

  it("zorunluysa boş bırakılamaz", () => {
    expect(schema.safeParse({ kapasite: "" }).success).toBe(false);
  });
});

describe("buildCustomFieldsSchema — DATE", () => {
  const schema = buildCustomFieldsSchema([
    field({ key: "montaj", label: "Montaj", type: "DATE" }),
  ]);

  it("geçerli tarihi metin olarak saklar", () => {
    expect(schema.parse({ montaj: "2026-03-14" }).montaj).toBe("2026-03-14");
  });

  it("olmayan günü reddeder", () => {
    const result = schema.safeParse({ montaj: "2026-02-31" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Montaj geçersiz tarih");
  });

  it("biçimsizi reddeder", () => {
    expect(schema.safeParse({ montaj: "14.03.2026" }).success).toBe(false);
  });
});

describe("buildCustomFieldsSchema — SELECT ve BOOL", () => {
  const schema = buildCustomFieldsSchema([
    field({ key: "yakit", label: "Yakıt", type: "SELECT", options: ["Benzin", "Dizel"] }),
    field({ key: "aktif", label: "Aktif", type: "BOOL" }),
  ]);

  it("tanımlı seçeneği kabul eder", () => {
    expect(schema.parse({ yakit: "Dizel" }).yakit).toBe("Dizel");
  });

  it("tanımsız seçeneği reddeder", () => {
    const result = schema.safeParse({ yakit: "LPG" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe("Yakıt için geçersiz seçenek");
  });

  it("form onay kutusunu boolean'a çevirir", () => {
    expect(schema.parse({ aktif: "on" }).aktif).toBe(true);
    expect(schema.parse({ aktif: "" }).aktif).toBe(false);
  });

  it("seçeneksiz SELECT hiçbir değeri kabul etmez", () => {
    const bozuk = buildCustomFieldsSchema([
      field({ key: "x", label: "X", type: "SELECT", options: [] }),
    ]);
    expect(bozuk.safeParse({ x: "bir" }).success).toBe(false);
    expect(bozuk.safeParse({}).success).toBe(true);
  });
});

describe("gizli alanlar", () => {
  const fields = [
    field({ key: "renk", label: "Renk", type: "TEXT" }),
    field({ key: "eski", label: "Eski", type: "TEXT", required: true, hidden: true }),
  ];

  it("gizli alan görünürlerden ayıklanır", () => {
    expect(visibleFields(fields).map((f) => f.key)).toEqual(["renk"]);
  });

  it("gizli zorunlu alan doğrulamayı kilitlemez", () => {
    expect(buildCustomFieldsSchema(fields).safeParse({ renk: "mavi" }).success).toBe(true);
  });
});

describe("mergeCustomFields", () => {
  const fields = [
    field({ key: "renk", label: "Renk", type: "TEXT" }),
    field({ key: "eski", label: "Eski", type: "TEXT", hidden: true }),
  ];

  it("gizli ve tanımsız anahtarların değerini korur", () => {
    const merged = mergeCustomFields(
      { renk: "mavi", eski: "kalsın", silinmis_tanim: "dokunma" },
      { renk: "kırmızı" },
      fields,
    );
    expect(merged).toEqual({
      renk: "kırmızı",
      eski: "kalsın",
      silinmis_tanim: "dokunma",
    });
  });

  it("görünür alan boş geldiyse siler", () => {
    expect(mergeCustomFields({ renk: "mavi" }, {}, fields)).toEqual({});
  });

  it("bozuk mevcut değerle çökmez", () => {
    expect(mergeCustomFields("metin", { renk: "mavi" }, fields)).toEqual({ renk: "mavi" });
    expect(mergeCustomFields(null, {}, fields)).toEqual({});
  });
});

describe("readCustomFields", () => {
  const fields = [
    field({ key: "renk", label: "Renk", type: "TEXT" }),
    field({ key: "aktif", label: "Aktif", type: "BOOL" }),
    field({ key: "montaj", label: "Montaj", type: "DATE" }),
    field({ key: "kapasite", label: "Kapasite", type: "NUMBER" }),
    field({ key: "gizli", label: "Gizli", type: "TEXT", hidden: true }),
  ];

  it("eksik ve fazla anahtara dayanıklı", () => {
    const rows = readCustomFields(
      { aktif: false, montaj: "2026-03-14", kapasite: 1234.5, fazladan: "x", gizli: "y" },
      fields,
    );
    expect(rows).toEqual([
      { key: "aktif", label: "Aktif", text: "Hayır" },
      { key: "montaj", label: "Montaj", text: "14.03.2026" },
      { key: "kapasite", label: "Kapasite", text: "1.234,5" },
    ]);
  });

  it("değer yoksa boş liste", () => {
    expect(readCustomFields(null, fields)).toEqual([]);
  });
});

describe("keyFromLabel", () => {
  it("Türkçe harfleri indirger", () => {
    expect(keyFromLabel("Ekran Boyutu (inç)")).toBe("ekran_boyutu_inc");
    expect(keyFromLabel("Şarj Döngüsü")).toBe("sarj_dongusu");
  });

  it("baştaki ve sondaki ayracı temizler", () => {
    expect(keyFromLabel("  --Renk--  ")).toBe("renk");
  });
});
