"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageViewer } from "@/components/ImageViewer";
import { Thumb } from "@/components/Thumb";
import { shrinkImage } from "@/lib/image-client";

/**
 * Ekipmanın küçük görseli — dokunulabilir. Listede ve detay başlığında aynı.
 *
 * Fotoğrafı varsa büyütüyor; yoksa doğrudan kamerayı açıyor. Fotoğraf eklemek
 * için ekipmanı açıp ekler bölümüne inmek, elinde telefonla makinenin başında
 * duran kullanıcı için uzun bir yol.
 *
 * Satır bağlantısının dışında duruyor (bkz. `Row.leading`): içinde olsaydı
 * dokunuş ekipmanı açardı.
 */
export function ItemPhoto({
  itemId,
  name,
  url,
  icon,
  editable,
  size = "sm",
}: {
  itemId: string;
  name: string;
  url: string | null;
  icon: string | null;
  editable: boolean;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    // Küçültme yalnız görselde; kameradan gelen kare büyük oluyor (#30, #31).
    body.append("file", await shrinkImage(file));
    body.append("kind", "PHOTO");

    const response = await fetch(`/api/ekipman/${itemId}/ekler`, {
      method: "POST",
      body,
    });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  // Fotoğrafı da yoksa ve ekleyemiyorsa dokunulacak bir şey yok.
  if (!url && !editable) {
    return <Thumb url={null} alt={name} icon={icon} size={size} />;
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (url) setViewing(true);
          else fileInput.current?.click();
        }}
        aria-label={url ? `${name} fotoğrafını büyüt` : `${name} için fotoğraf çek`}
        // shrink-0: esnek bir satırda düğme daralınca içindeki sabit boyutlu
        // görsel taşıp yanındaki metnin üstüne biniyordu (TUZAKLAR #66).
        className="relative block shrink-0 rounded-[8px] active:opacity-70 disabled:opacity-50"
      >
        <Thumb url={url} alt={name} icon={icon} size={size} />
        {!url ? (
          // Boş kutunun dokunulabilir olduğu görünsün: köşede küçük bir kamera.
          <span
            aria-hidden
            className={`absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-blue text-white ${
              size === "lg" ? "h-5 w-5 text-[11px]" : "h-4 w-4 text-[9px]"
            }`}
          >
            ＋
          </span>
        ) : null}
      </button>

      {editable ? (
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          // Doğrudan kamera: "hızlıca foto ekle" isteği bu.
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = "";
            if (picked) void upload(picked);
          }}
        />
      ) : null}

      <ImageViewer
        open={viewing}
        url={url ?? ""}
        name={name}
        onClose={() => setViewing(false)}
      />
    </>
  );
}
