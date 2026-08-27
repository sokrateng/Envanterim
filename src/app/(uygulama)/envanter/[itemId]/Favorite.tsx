"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Favori kalbi — fotoğraf bandının üstünde yüzüyor.
 *
 * İyimser: dokunuşta kalp hemen doluyor, istek arkadan gidiyor. İşaret
 * kişisel ve tersine çevrilebilir; yanlış giderse geri alma maliyeti bir
 * dokunuş, oysa bekleyen bir kalp her dokunuşta duraksatırdı.
 */
export function Favorite({
  itemId,
  favorite,
}: {
  itemId: string;
  favorite: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(favorite);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);

    const response = await fetch(`/api/ekipman/${itemId}/favori`, {
      method: next ? "PUT" : "DELETE",
    });
    setBusy(false);

    if (!response.ok) {
      setOn(!next);
      return;
    }
    // Liste filtresi sunucuda: işaret değişince oradaki sayı da değişmeli.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={on}
      aria-label={on ? "Favorilerden çıkar" : "Favorilere ekle"}
      className="grid h-touch w-touch place-items-center rounded-full bg-black/35 text-[20px] text-white backdrop-blur active:opacity-60"
    >
      <span aria-hidden className={on ? "text-red" : "text-white"}>
        {on ? "♥" : "♡"}
      </span>
    </button>
  );
}
