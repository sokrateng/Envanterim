/**
 * Ekipman küçük görseli: fotoğrafı varsa fotoğraf, yoksa kategori simgesi.
 *
 * Listede ve detayda aynı kutu kullanılıyor; fotoğrafı olmayan satır da aynı
 * yeri kaplıyor, böylece liste hizası bozulmuyor.
 *
 * Boş kutunun zemini `fill` jetonu: sayfa zeminiyle aynı olsaydı satırın
 * kart yüzeyinde bir delik gibi görünürdü, dolu bir kutu gibi de durmamalı.
 *
 * Ekler kimlik doğrulamalı uçtan gelebiliyor; next/image yerine düz img —
 * uzak yükleyici yapılandırması gerekmesin (Attachments'taki kuralın aynısı).
 */
export function Thumb({
  url,
  alt,
  icon,
  size = "sm",
}: {
  url: string | null;
  alt: string;
  /** Fotoğraf yoksa görünen simge; yoksa nötr bir kutu çıkıyor. */
  icon?: string | null;
  /** `hero`: detay sayfasının tepesindeki tam genişlik bandı. */
  size?: "sm" | "lg" | "hero";
}) {
  const boxes = {
    sm: "h-11 w-11 rounded-[8px] text-[20px]",
    lg: "h-16 w-16 rounded-card text-[28px]",
    hero: "h-[220px] w-full text-[56px]",
  };
  const box = boxes[size];

  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={`${box} shrink-0 bg-fill object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${box} grid shrink-0 place-items-center bg-fill text-muted`}
    >
      {icon ?? "📦"}
    </div>
  );
}
