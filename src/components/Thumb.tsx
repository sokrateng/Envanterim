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
    return size === "hero" ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={alt}
        // Bant fotoğrafın boyuna uyuyor ve fotoğraf **kırpılmıyor**: sabit
        // yükseklik + `object-cover` ürünün ortasından bir şerit gösteriyordu,
        // dikey çekilmiş bir yazıcının yalnız gövdesi görünüyordu. Oysa bandın
        // işi "hangi cihazdı bu" sorusunu cevaplamak — ürünün tamamı görünmeli.
        // Alt sınır sayfanın yüklenirken zıplamasını, üst sınır dikey bir
        // fotoğrafın ekranı yemesini engelliyor.
        className="min-h-[220px] max-h-[60dvh] w-full bg-fill object-contain"
      />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={alt}
        loading="lazy"
        // Küçük kutuda kırpma doğru: 44 pikselde sığdırmak fotoğrafı iyice
        // küçültür, liste hizası da bozulurdu.
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
