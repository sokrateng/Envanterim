"use client";

import { useEffect } from "react";

/**
 * Service worker'ı uygulama açılır açılmaz kaydeder.
 *
 * Eskiden yalnız bildirim açılınca kaydediliyordu; çevrimdışı okuma bildirimden
 * bağımsız olmalı — depoda ya da serviste envantere bakmak için bildirime izin
 * vermek gerekmiyor.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Kayıt sayfa yüklenmesini yavaşlatmasın.
    const timer = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
