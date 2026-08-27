import { isValidToken } from "@/lib/share";

/**
 * Okutulan kodun ne olduğunu çözer — saf ve testli.
 *
 * İki tür kod okutuluyor (docs/URUN.md): uygulamanın kendi QR etiketi ve
 * cihazın üstündeki barkod/seri no. Etiket ürün sayfasını açar, barkod ise
 * aramaya düşer — okunan metin doğrudan bir kimlik sayılmaz.
 *
 * Yabancı bir QR'ı açmıyoruz: ekrandaki bağlantıya dokunmak kullanıcının
 * kararı olmalı, kameranın gördüğü şeyin değil.
 */

export type ScanTarget =
  | { kind: "item"; itemId: string }
  | { kind: "share"; token: string }
  | { kind: "search"; query: string }
  | { kind: "unknown"; text: string };

/**
 * Kimlik olabilecek yol parçası. Uydurma bir kimlik de bu kalıba uyar; sunucu
 * bulamayınca aramaya düşürüyor.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Aranabilir metin sınırı: barkod ve seri no bu boyu geçmez. */
export const MAX_QUERY_LENGTH = 64;

/** Barkodun sonundaki CR, sıfır genişlikli karakterler ve fazla boşluk gider. */
export function normalizePayload(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fromPath(pathname: string): ScanTarget | null {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  if (segments[0] === "envanter" && segments[1] && ID_PATTERN.test(segments[1])) {
    return { kind: "item", itemId: segments[1] };
  }
  if (segments[0] === "p" && segments[1] && isValidToken(segments[1])) {
    return { kind: "share", token: segments[1] };
  }
  return null;
}

export function readScan(raw: string): ScanTarget | null {
  const text = normalizePayload(raw);
  if (!text) return null;

  // Etiket, taban adres tanımsızken göreli yol basıyor (src/lib/qr.ts):
  // "/envanter/abc" de geçerli bir etiket içeriği.
  if (text.startsWith("/")) {
    return fromPath(text.split(/[?#]/)[0]) ?? { kind: "unknown", text };
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      return fromPath(new URL(text).pathname) ?? { kind: "unknown", text };
    } catch {
      return { kind: "unknown", text };
    }
  }

  // Başka bir şema (mailto:, tel:, WIFI:) aramada işe yaramaz.
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return { kind: "unknown", text };

  if (text.length > MAX_QUERY_LENGTH) return { kind: "unknown", text };
  return { kind: "search", query: text };
}

/** Kullanıcıya "ne okuduk" diye gösterilen kısa metin. */
export function scanSummary(target: ScanTarget): string {
  switch (target.kind) {
    case "item":
      return "Envanterim etiketi";
    case "share":
      return "Paylaşım bağlantısı";
    case "search":
      return `Kod: ${target.query}`;
    case "unknown":
      return "Tanınmayan kod";
  }
}

export type SerialRead =
  | { ok: true; serial: string; model?: string }
  | { ok: false; message: string };

/**
 * Okutulan kodu seri no alanına yazılabilir bir metne çevirir — saf ve testli.
 *
 * Cihazın üstündeki barkod seri no taşır; kendi QR etiketimiz taşımaz. Etiketi
 * kazara okutan kullanıcının alanına ürün adresi yazılmamalı: alan sessizce
 * yanlış dolmaktansa boş kalır ve sebebi söylenir.
 */
/**
 * Üretici QR'larında seri no çoğu zaman adresin içinde bir parametre olarak
 * duruyor: `https://marka.com/dogrula?sn=FD9901123456`. Adı belli olan
 * parametreyi almak tahmin değil; adresin geri kalanını seri no saymıyoruz.
 */
const SERIAL_PARAMS = [
  "sn",
  "s/n",
  "s-n",
  "snr",
  "seri",
  "serino",
  "serial",
  "serialno",
  "serialnum",
  "serialnumber",
  "sernum",
];

/**
 * Kayıt adreslerinde alan adları tek harfe iniyor — gerçek bir etiket:
 * `http://www.registeryourshark.com/reg/?m=FA300EU&s=A20XX712Z1Q1`. `s` tek
 * başına "search" de olabildiği için burada ad yetmiyor, değerin seri noya
 * benzemesi de gerekiyor.
 */
const SHORT_SERIAL_PARAMS = ["s", "sno"];

/** Aynı QR çoğu zaman modeli de taşıyor; boş model alanını o dolduruyor. */
const MODEL_PARAMS = ["m", "mn", "model", "modelno", "modelnumber"];

/**
 * Seri no biçimi: boşluksuz, en az bir rakamlı, makul boyda. Arama sorgusunu
 * ("shark", "buzdolabı fiyat") bu eleme dışarıda bırakıyor.
 */
function looksLikeSerial(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{4,31}$/.test(value) && /\d/.test(value);
}

function params(text: string): Map<string, string> | null {
  let url: URL;
  try {
    // Göreli yol da URL olarak çözülsün diye taban adres veriliyor; hangi
    // taban olduğu önemli değil, yalnız sorgu dizesi okunuyor.
    url = new URL(text, "https://envanterim.local");
  } catch {
    return null;
  }

  const found = new Map<string, string>();
  for (const [key, value] of url.searchParams) {
    const name = key.trim().toLowerCase();
    const candidate = value.trim();
    if (!candidate || candidate.length > MAX_QUERY_LENGTH) continue;
    if (!found.has(name)) found.set(name, candidate);
  }
  return found;
}

function pick(found: Map<string, string>, names: string[]): string | null {
  for (const name of names) {
    const value = found.get(name);
    if (value) return value;
  }
  return null;
}

/** Adresin içindeki seri no ve model — bulunamayan null döner. */
export function serialFromUrl(
  text: string,
): { serial: string; model: string | null } | null {
  const found = params(text);
  if (!found) return null;

  const named = pick(found, SERIAL_PARAMS);
  const short = pick(found, SHORT_SERIAL_PARAMS);
  const serial = named ?? (short && looksLikeSerial(short) ? short : null);
  if (!serial) return null;

  const model = pick(found, MODEL_PARAMS);
  return { serial, model: model && model.length <= 64 ? model : null };
}

export function serialFromScan(raw: string): SerialRead {
  const text = normalizePayload(raw);
  if (!text) return { ok: false, message: "Kod okunamadı" };

  const target = readScan(text);
  if (target?.kind === "item" || target?.kind === "share") {
    return {
      ok: false,
      message: "Bu Envanterim etiketi, seri no değil. Cihazın üstündeki barkodu okut.",
    };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("/")) {
    const fromUrl = serialFromUrl(text);
    if (fromUrl) {
      return fromUrl.model
        ? { ok: true, serial: fromUrl.serial, model: fromUrl.model }
        : { ok: true, serial: fromUrl.serial };
    }
    return {
      ok: false,
      message: "Bu adreste seri no yok. Cihazın üstündeki barkodu okut.",
    };
  }
  if (text.length > MAX_QUERY_LENGTH) {
    return { ok: false, message: "Kod seri no olamayacak kadar uzun" };
  }

  return { ok: true, serial: text };
}
