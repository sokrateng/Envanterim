import { describe, expect, it } from "vitest";
import {
  BOM,
  detectSeparator,
  escapeCell,
  mapHeaders,
  normalizeHeader,
  parseCsv,
  toCsv,
  toTable,
} from "./csv";

describe("escapeCell", () => {
  it("düz metni olduğu gibi bırakır", () => {
    expect(escapeCell("Çamaşır makinesi")).toBe("Çamaşır makinesi");
  });

  it("ayraç, tırnak ve satır sonunu tırnaklar", () => {
    expect(escapeCell("Bosch; Siemens")).toBe('"Bosch; Siemens"');
    expect(escapeCell('12" ekran')).toBe('"12"" ekran"');
    expect(escapeCell("iki\nsatır")).toBe('"iki\nsatır"');
  });

  it("virgül ayracında virgülü tırnaklar", () => {
    expect(escapeCell("a,b", ",")).toBe('"a,b"');
    expect(escapeCell("a,b", ";")).toBe("a,b");
  });
});

describe("toCsv", () => {
  it("başlık ve satırları noktalı virgülle yazar", () => {
    const csv = toCsv([{ Ad: "Buzdolabı", Marka: "Arçelik" }], ["Ad", "Marka"]);
    expect(csv).toBe(`${BOM}Ad;Marka\r\nBuzdolabı;Arçelik\r\n`);
  });

  it("eksik alanı boş bırakır", () => {
    const csv = toCsv([{ Ad: "X" }], ["Ad", "Marka"]);
    expect(csv.split("\r\n")[1]).toBe("X;");
  });

  it("Excel'in Türkçe karakteri bozmaması için BOM koyar", () => {
    expect(toCsv([], ["Ad"]).startsWith(BOM)).toBe(true);
  });
});

describe("detectSeparator", () => {
  it("noktalı virgülü seçer", () => {
    expect(detectSeparator("Ad;Marka;Model\nx;y;z")).toBe(";");
  });

  it("virgülle yazılmış dosyayı da okur", () => {
    expect(detectSeparator("Ad,Marka,Model\nx,y,z")).toBe(",");
  });

  it("sekmeyi tanır", () => {
    expect(detectSeparator("Ad\tMarka\nx\ty")).toBe("\t");
  });

  it("BOM ayracı şaşırtmaz", () => {
    expect(detectSeparator(`${BOM}Ad;Marka\nx;y`)).toBe(";");
  });
});

describe("parseCsv", () => {
  it("basit tabloyu okur", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("tırnak içindeki ayracı bölmez", () => {
    expect(parseCsv('a;b\n"x;y";2')).toEqual([
      ["a", "b"],
      ["x;y", "2"],
    ]);
  });

  it("tırnak içindeki satır sonunu korur", () => {
    expect(parseCsv('a\n"iki\nsatır"')).toEqual([["a"], ["iki\nsatır"]]);
  });

  it("çift tırnak kaçışını çözer", () => {
    expect(parseCsv('a\n"12"" ekran"')).toEqual([["a"], ['12" ekran']]);
  });

  it("Windows satır sonuyla çalışır", () => {
    expect(parseCsv("a;b\r\n1;2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("boş satırları atar", () => {
    expect(parseCsv("a;b\n\n1;2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("kendi yazdığını geri okur", () => {
    const rows = [{ Ad: 'Ekran 12" ; büyük', Not: "iki\nsatır" }];
    const table = toTable(toCsv(rows, ["Ad", "Not"]));
    expect(table.rows[0]).toEqual({ Ad: 'Ekran 12" ; büyük', Not: "iki\nsatır" });
  });
});

describe("toTable", () => {
  it("başlıkları sözlüğe çevirir", () => {
    const table = toTable("Ad;Marka\r\nBuzdolabı;Arçelik\r\n");
    expect(table.headers).toEqual(["Ad", "Marka"]);
    expect(table.rows).toEqual([{ Ad: "Buzdolabı", Marka: "Arçelik" }]);
  });

  it("eksik hücreyi boş yapar", () => {
    expect(toTable("Ad;Marka\nX").rows[0]).toEqual({ Ad: "X", Marka: "" });
  });

  it("boş dosyada boş tablo", () => {
    expect(toTable("")).toEqual({ headers: [], rows: [] });
  });
});

describe("normalizeHeader / mapHeaders", () => {
  it("Türkçe karakteri ve boşluğu yok sayar", () => {
    expect(normalizeHeader("Seri No")).toBe("serino");
    expect(normalizeHeader("SERİ NO")).toBe("serino");
    expect(normalizeHeader("Alış Tutarı")).toBe("alistutari");
  });

  it("başlıkları alanlara eşler", () => {
    const mapping = mapHeaders(["Ad", "SERİ NO", "Bilinmeyen"], {
      name: ["Ad", "İsim"],
      serialNo: ["Seri no"],
      brand: ["Marka"],
    });
    expect(mapping).toEqual({ name: "Ad", serialNo: "SERİ NO" });
  });

  it("eşleşmeyen alanı atlar", () => {
    expect(mapHeaders(["Foo"], { name: ["Ad"] })).toEqual({});
  });
});
