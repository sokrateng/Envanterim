import { EnvanterLink } from "@/components/EnvanterLink";
import { ItemPhoto } from "@/components/ItemPhoto";
import { Favorite } from "./Favorite";

/**
 * Detay sayfasının tepesi: tam genişlik fotoğraf bandı.
 *
 * Küçük bir görselin yanında duran başlık, uzun adlarda iki satıra bile
 * sığmıyordu. Bant hem adı serbest bırakıyor hem de "hangi cihazdı bu"
 * sorusunu bir bakışta cevaplıyor — envanterde ad çoğu zaman ayırt etmiyor,
 * fotoğraf ediyor.
 *
 * Geri ve favori düğmeleri bandın üstünde yüzüyor: bant ekranın en üstünden
 * başlıyor, altında ayrı bir başlık çubuğu olsaydı iki kez yer kaplardı.
 */
export function Hero({
  itemId,
  name,
  photoUrl,
  icon,
  editable,
  favorite,
}: {
  itemId: string;
  name: string;
  photoUrl: string | null;
  icon: string | null;
  editable: boolean;
  favorite: boolean;
}) {
  return (
    <div className="relative">
      <ItemPhoto
        size="hero"
        itemId={itemId}
        name={name}
        url={photoUrl}
        icon={icon}
        editable={editable}
      />

      {/* Çentiğin altında kalmasınlar; bant güvenli alanın içine uzanıyor. */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] flex justify-between px-3">
        <EnvanterLink
          label="Envantere dön"
          className="pointer-events-auto grid h-touch w-touch place-items-center rounded-full bg-black/35 text-title text-white backdrop-blur active:opacity-60"
        >
          <span aria-hidden>‹</span>
        </EnvanterLink>
        <div className="pointer-events-auto">
          <Favorite itemId={itemId} favorite={favorite} />
        </div>
      </div>
    </div>
  );
}
