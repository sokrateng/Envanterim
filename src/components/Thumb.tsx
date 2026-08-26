/**
 * Ekipman küçük görseli: fotoğrafı varsa fotoğraf, yoksa kategori simgesi.
 *
 * Listede ve detayda aynı kutu kullanılıyor; fotoğrafı olmayan satır da aynı
 * yeri kaplıyor, böylece liste hizası bozulmuyor.
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
  size?: "sm" | "lg";
}) {
  const box =
    size === "lg"
      ? "h-16 w-16 rounded-card text-[28px]"
      : "h-11 w-11 rounded-[8px] text-[20px]";

  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={`${box} shrink-0 bg-bg object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${box} grid shrink-0 place-items-center bg-bg text-muted`}
    >
      {icon ?? "📦"}
    </div>
  );
}
