import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/item-status";

/**
 * Panelin çizim parçaları — kütüphanesiz, sunucuda çiziliyor.
 *
 * Bir grafik kütüphanesi taşımıyoruz: buradaki işlerin hepsi oran çubuğu ve
 * sayı, hepsi düz HTML ile çizilebiliyor. Telefonda 100 KB'lık bir çizim
 * kütüphanesi indirmek, gösterdiği bilgiden pahalıya geliyordu.
 *
 * Kurallar:
 * - **Renk tek başına bilgi taşımıyor.** Her çubuğun yanında etiketi ve sayısı
 *   yazıyor; renk yalnız pekiştiriyor. Renk körlüğünde de, siyah beyaz
 *   çıktıda da kart okunuyor.
 * - **Büyüklük karşılaştırmasında tek renk.** Kategori ve marka çubukları aynı
 *   maviyi kullanıyor: mesajı boy taşıyor, gökkuşağı yalnız gürültü olurdu.
 *   Ayrı renk yalnız durum ve garanti kartlarında, çünkü orada renk zaten
 *   uygulamanın başka yerlerinde de aynı anlamı taşıyor (yeşil kullanımda,
 *   turuncu serviste…).
 * - **Sınıf adı birleştirilmiyor**, Tailwind taranan dosyada tam adı görmeli
 *   (TUZAKLAR #61).
 */

const BAR_TONE: Record<StatusTone, string> = {
  green: "bg-green",
  orange: "bg-orange",
  blue: "bg-blue",
  muted: "bg-separator",
};

const DOT_TONE: Record<StatusTone, string> = {
  green: "bg-green",
  orange: "bg-orange",
  blue: "bg-blue",
  muted: "bg-separator",
};

export function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-4 mt-3 rounded-card bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-footnote uppercase text-muted">{title}</h2>
        {action}
      </div>
      {hint ? <p className="pt-1 text-caption text-muted">{hint}</p> : null}
      <div className="pt-3">{children}</div>
    </section>
  );
}

/** Tek sayı: panelin en üstündeki kutular. */
export function StatTile({
  label,
  value,
  note,
  tone = "muted",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: StatusTone;
}) {
  return (
    <div className="rounded-card bg-surface p-3">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone]}`}
        />
        <p className="truncate text-caption uppercase text-muted">{label}</p>
      </div>
      {/* Sayı büyük: panele bakan kişi önce buna bakıyor. Uzun tutarlarda
          satır kesilmesin diye kırpma değil, küçülen punto yok — tutar
          kırpılırsa yanlış okunur. */}
      <p className="pt-0.5 text-title tabular-nums">{value}</p>
      {note ? <p className="text-caption text-muted">{note}</p> : null}
    </div>
  );
}

export type BarRow = {
  key: string;
  label: string;
  /** Sağda yazan değer: "12 adet", "%40" ya da tutar. */
  value: string;
  /** Çubuğun boyu, yüzde. */
  share: number;
  tone?: StatusTone;
};

/**
 * Yatay çubuk listesi. Telefonda dikey sütundan iyi: uzun kategori adları
 * yatayda okunuyor, dikeyde eğik yazmak ya da kısaltmak gerekiyordu.
 */
export function BarList({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-subheadline">
              {row.label}
            </span>
            <span className="shrink-0 text-subheadline tabular-nums text-muted">
              {row.value}
            </span>
          </div>
          {/* Çubuk yalnız pekiştirme: değer zaten yukarıda yazıyor. */}
          <div
            aria-hidden
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill"
          >
            <div
              className={`h-full rounded-full ${BAR_TONE[row.tone ?? "blue"]}`}
              // Sıfıra yakın pay da görünsün: bir ekipmanlık satır büsbütün
              // kaybolursa satırın çubuğu yokmuş gibi duruyor.
              style={{ width: `${Math.max(row.share, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Yıl sütunları. Zaman ekseni soldan sağa: yaş profili bir bakışta görünsün.
 * Sütun boyu en yoğun yıla göre — yıllar birbiriyle karşılaştırılıyor.
 */
export function YearBars({
  rows,
}: {
  rows: Array<{ year: number; count: number; share: number }>;
}) {
  return (
    /* Sütun genişliği sabit: tek yılı olan envanterde `flex-1` sütunu
       ekran genişliğinde bir duvara çeviriyordu. Çok yıl varsa yatayda
       kayıyor — sayfa gövdesi değil, kartın içi. */
    <ul className="flex items-end gap-1.5 overflow-x-auto">
      {rows.map((row) => (
        <li key={row.year} className="flex w-9 shrink-0 flex-col items-center gap-1">
          <span className="text-caption tabular-nums text-muted">
            {row.count}
          </span>
          <div className="flex h-20 w-full items-end">
            <div
              aria-hidden
              className="w-full rounded-t-[4px] bg-blue"
              style={{ height: `${Math.max(row.share, 4)}%` }}
            />
          </div>
          <span className="text-caption tabular-nums text-muted">
            {String(row.year).slice(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Kapsam ölçeri: "kaçının fotoğrafı var" gibi tek oranlar. */
export function Meter({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-footnote">{label}</span>
        <span className="shrink-0 text-footnote tabular-nums text-muted">
          {value}/{total}
        </span>
      </div>
      <div
        aria-hidden
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill"
      >
        <div
          className="h-full rounded-full bg-blue"
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}
