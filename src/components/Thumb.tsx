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
/**
 * Detay bandının yüksekliği. 390×844'te ekranın üçte biri: fotoğraf tanınacak
 * kadar büyük, altındaki ad ve ilk bilgi satırları da kaydırmadan görünüyor.
 */
const HERO_H = "h-[260px]";

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
    hero: `${HERO_H} w-full text-[56px]`,
  };
  const box = boxes[size];

  if (url) {
    return size === "hero" ? (
      /**
       * Bandın boyu sabit, fotoğraf içine **sığdırılıyor**.
       *
       * İki uçtan da geçtik: `object-cover` ürünün ortasından bir şerit
       * gösteriyordu (dikey bir fotoğrafın üstü altı kesiliyordu); boyu
       * fotoğrafa uydurmak ise dikey fotoğrafta ekranın yarısını yiyordu.
       * Sabit alan + sığdırma ikisini de çözüyor: her ekipmanda aynı yüksekli,
       * kesilmeyen bir fotoğraf ve altında hep aynı yerde başlayan bilgiler.
       */
      <div className={`relative ${HERO_H} w-full overflow-hidden bg-fill`}>
        {/* Yanlarda kalan boşluk ölü gri bir şerit olarak durmasın diye aynı
            fotoğrafın bulanık kopyası zemine seriliyor. İkinci bir indirme
            değil — tarayıcı aynı adresi önbellekten veriyor. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="relative h-full w-full object-contain"
        />
      </div>
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
