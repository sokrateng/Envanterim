"use client";

import { useEffect, useRef } from "react";

/**
 * Tam ekran/alttan açılan katman açıkken donanım "geri"si katmanı kapatmalı,
 * sayfadan atmamalı (TUZAKLAR #17). İki ayrı katman aynı popstate'i dinlerse
 * karışır (TUZAKLAR #18) — bu yüzden kayda kimlik damgası koyup dönen olayın
 * bize ait olup olmadığını **düşülen kaydın damgasından** anlıyoruz.
 */
type LayerState = { __katman?: string };

export function useHistoryLayer(
  open: boolean,
  onClose: () => void,
  id: string,
) {
  // Kapatmanın tüm yolları tek kanaldan geçsin diye kapanış bir kez çalışır.
  const closing = useRef(false);

  // Kapatma geri çağrısı her render'da yeni bir kimlik alıyor. Efektin
  // bağımlılığı olsaydı katman açıkken gelen her yeniden çizim (örn.
  // router.refresh) efekti söküp kurar, sökme sırasındaki history.back()
  // paneli kendiliğinden kapatırdı. En güncel işlevi ref'te tutuyoruz.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    closing.current = false;

    window.history.pushState({ __katman: id } satisfies LayerState, "");

    const onPop = (event: PopStateEvent) => {
      const landed = (event.state ?? {}) as LayerState;
      if (landed.__katman === id) return; // hâlâ bizim kaydımızdayız
      if (closing.current) return;
      closing.current = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // ✕ / Esc / boşluk ile kapandıysa bıraktığımız kaydı temizle.
      const current = (window.history.state ?? {}) as LayerState;
      if (!closing.current && current.__katman === id) {
        closing.current = true;
        window.history.back();
      }
    };
  }, [open, id]);
}
