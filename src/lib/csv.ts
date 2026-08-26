/**
 * CSV dışa/içe aktarma — saf ve testli.
 *
 * Türkçe Excel liste ayracı olarak **noktalı virgül** bekliyor; virgülle
 * yazılan dosyayı tek sütuna basıyor. Okurken ayracı dosyadan anlıyoruz,
 * yazarken noktalı virgül kullanıyoruz. Dosyanın başına BOM konuyor, yoksa
 * Excel "Çamaşır"ı bozuk gösteriyor.
 */

export const BOM = "﻿";
const SEPARATORS = [";", ",", "\t"] as const;

/** Bir hücreyi kaçırır: ayraç, tırnak ve satır sonu varsa tırnak içine alır. */
export function escapeCell(value: string, separator = ";"): string {
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv(
  rows: Array<Record<string, string>>,
  columns: string[],
  separator = ";",
): string {
  const lines = [columns.map((column) => escapeCell(column, separator)).join(separator)];

  for (const row of rows) {
    lines.push(
      columns
        .map((column) => escapeCell(row[column] ?? "", separator))
        .join(separator),
    );
  }

  // Excel Windows satır sonu bekliyor; başka araçlar da bunu okuyor.
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Ayracı ilk satırdaki sayıya göre seçer. */
export function detectSeparator(text: string): string {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  let best = ";";
  let bestCount = -1;

  for (const separator of SEPARATORS) {
    // Tırnak içindekiler sayılmasın diye kaba bir temizlik yeterli: başlık
    // satırında tırnaklı hücre nadir.
    const count = firstLine.split(separator).length - 1;
    if (count > bestCount) {
      best = separator;
      bestCount = count;
    }
  }

  return best;
}

/**
 * CSV metnini satırlara böler. Tırnak içindeki ayraç ve satır sonu korunur;
 * "" kaçışı tek tırnağa çevrilir.
 */
export function parseCsv(text: string, separator = detectSeparator(text)): string[][] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];

    if (inQuotes) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }

  // Tamamen boş satırlar (dosya sonundaki satır sonu) atılır.
  return rows.filter((line) => line.some((value) => value.trim() !== ""));
}

export type CsvTable = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

/** Başlık satırını sözlüğe çevirir; başlıklar kırpılır ve küçültülür. */
export function toTable(text: string): CsvTable {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { headers: [], rows: [] };

  const headers = parsed[0].map((header) => header.trim());
  const rows = parsed.slice(1).map((line) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (line[index] ?? "").trim();
    });
    return row;
  });

  return { headers, rows };
}

/** Başlık eşleşmesi: büyük/küçük harf ve Türkçe karakter farkını yok sayar. */
export function normalizeHeader(header: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return header
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Dosyadaki başlıkları bilinen alanlara eşler. */
export function mapHeaders(
  headers: string[],
  known: Record<string, string[]>,
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [field, aliases] of Object.entries(known)) {
    const wanted = aliases.map(normalizeHeader);
    const found = headers.find((header) => wanted.includes(normalizeHeader(header)));
    if (found) mapping[field] = found;
  }

  return mapping;
}
