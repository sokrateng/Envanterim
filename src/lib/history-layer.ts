"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Tam ekran/alttan açılan katman açıkken donanım "geri"si katmanı kapatmalı,
 * sayfadan atmamalı (TUZAKLAR #17). İki ayrı katman aynı popstate'i dinlerse
 * karışır (TUZAKLAR #18) — bu yüzden kayda kimlik damgası koyup dönen olayın
 * bize ait olup olmadığını **düşülen kaydın damgasından** anlıyoruz.
 */
type LayerState = Record<string, unknown> & { __katman?: string };

export function useHistoryLayer(
  open: boolean,
  onClose: () => void,
  id: string,
): { restore: () => void } {
  // Kapatmanın tüm yolları tek kanaldan geçsin diye kapanış bir kez çalışır.
  const closing = useRef(false);
  /** Katman kaydı yaşarken dolu; geri koyma bunun varlığına bakıyor. */
  const live = useRef(false);

  // Kapatma geri çağrısı her render'da yeni bir kimlik alıyor. Efektin
  // bağımlılığı olsaydı katman açıkken gelen her yeniden çizim (örn.
  // router.refresh) efekti söküp kurar, sökme sırasındaki history.back()
  // paneli kendiliğinden kapatırdı. En güncel işlevi ref'te tutuyoruz.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    closing.current = false;

    // Next'in kendi geçmiş durumunu koruyup üstüne kendi damgamızı
    // ekliyoruz. Durumu ezersek geri dönüşte yönlendirici ağacı tanımıyor ve
    // kaydı eski RSC anlık görüntüsüyle geri kuruyor — panel kapanırken
    // yapılan router.refresh() böylece iptal oluyordu.
    window.history.pushState(
      { ...(window.history.state ?? {}), __katman: id } satisfies LayerState,
      "",
    );

    const onPop = (event: PopStateEvent) => {
      const landed = (event.state ?? {}) as LayerState;
      if (landed.__katman === id) return; // hâlâ bizim kaydımızdayız
      if (closing.current) return;
      closing.current = true;
      onCloseRef.current();
    };

    live.current = true;
    window.addEventListener("popstate", onPop);
    return () => {
      live.current = false;
      window.removeEventListener("popstate", onPop);
      // ✕ / Esc / boşluk ile kapandıysa bıraktığımız kaydı temizle.
      const current = (window.history.state ?? {}) as LayerState;
      if (!closing.current && current.__katman === id) {
        closing.current = true;
        window.history.back();
      }
    };
  }, [open, id]);

  /**
   * Geri tuşuyla gelen kapatma isteği iptal edilirse (kaydedilmemiş değişiklik
   * uyarısı gibi) katmanın geçmiş kaydını geri koyar. Kayıt geri konmazsa
   * sonraki geri tuşu paneli değil sayfayı kapatır; `closing` de sıfırlanmalı,
   * yoksa gelen popstate "zaten kapanıyoruz" diye yutulur.
   */
  const restore = useCallback(() => {
    if (!live.current) return;
    closing.current = false;
    window.history.pushState(
      { ...(window.history.state ?? {}), __katman: id } satisfies LayerState,
      "",
    );
  }, [id]);

  return { restore };
}

/**
 * Katmanı kapatır ve panelin bıraktığı geçmiş kaydı temizlendikten **sonra**
 * verilen işi yapar.
 *
 * Sıra önemli: kapanış `history.back()` ile oluyor. Kapanıştan önce yapılan
 * `router.refresh()` iptal oluyordu (yeni kayıt listede görünmüyordu); aynı
 * şekilde kapanıştan önce yapılan `router.replace()` de geri alınıyor —
 * adres çubuğu eski hâline dönüyor (TUZAKLAR #60).
 */
export function useCloseThen() {
  return useCallback((close: () => void, after: () => void) => {
    let done = false;
    let timer = 0;

    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("popstate", finish);
      window.clearTimeout(timer);
      after();
    };

    // Katmanın kaydı bir şekilde yoksa popstate hiç gelmez; iş yine de yapılsın.
    timer = window.setTimeout(finish, 400);
    window.addEventListener("popstate", finish);
    close();
  }, []);
}

/** Kapanış sonrası sayfayı yenileyen yaygın hâli. */
export function useCloseAndRefresh() {
  const router = useRouter();
  const closeThen = useCloseThen();

  return useCallback(
    (close: () => void) => closeThen(close, () => router.refresh()),
    [closeThen, router],
  );
}
