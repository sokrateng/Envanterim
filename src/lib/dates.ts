/**
 * Gün bazlı tarih işleri — saf ve testli.
 *
 * Buradaki her şey **yerel günün başıyla** çalışıyor: alış, garanti ve bakım
 * tarihleri gün olarak anlamlı, saat taşımıyorlar. UTC'ye çevirmek saat
 * dilimine göre bir gün kaydırıyordu (TUZAKLAR #27).
 *
 * Fatura modülünde duruyorlardı; oysa bakım planı da, ekipman formu da aynı
 * hesabı istiyor. Form bir istemci bileşeni: `invoice.ts`ten almak zod'u da
 * tarayıcıya taşırdı.
 */

/**
 * Ay ekler; ayın son gününü aşan tarihler o ayın sonuna çekilir.
 * 31 Ocak + 1 ay = 28/29 Şubat, "3 Mart" değil.
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/** "YYYY-MM-DD" metnini yerel günün başına çevirir; geçersizse null. */
export function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as unknown as [string, number, number, number];
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function toInputDate(date: Date | null): string {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
