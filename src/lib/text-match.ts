/**
 * SQLite'ta Prisma'nın `mode: "insensitive"` seçeneği yok ve `=` büyük/küçük
 * harfe duyarlı. Eşitlik denetimleri bu yüzden uygulamada yapılıyor.
 *
 * Postgres'teki davranışı koruyoruz: "I", "ı", "İ" ve "i" aynı sayılır. Türkçe
 * yerel ayarıyla küçültmek ("I" → "ı") barkodlarda geriye gidiş olurdu:
 * kayıtlı "SN-I22" ile okutulan "sn-i22" eşleşmezdi. Türkçe harfler (ç, ş, ğ,
 * ö, ü) ise farklı harf olarak kalıyor: "Cay" ile "Çay" ayrı firmalar.
 */
export function foldTurkish(value: string): string {
  return value
    .trim()
    .normalize("NFC")
    .replace(/[İIı]/g, "i")
    .toLowerCase();
}

export function sameText(a: string, b: string): boolean {
  return foldTurkish(a) === foldTurkish(b);
}
