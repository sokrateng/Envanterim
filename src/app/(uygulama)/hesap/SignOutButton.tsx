"use client";

import { signOut } from "next-auth/react";
import { forgetFilters } from "@/lib/last-filter";

/**
 * Çıkarken çevrimdışı önbelleği ve saklanan süzme de siliniyor: ortak bir
 * cihazda bir sonraki kullanıcı öncekinin envanterini de, hangi lokasyonu
 * süzdüğünü de görmesin.
 */
async function cikis() {
  forgetFilters();
  try {
    const kayit = await navigator.serviceWorker?.getRegistration();
    kayit?.active?.postMessage("temizle");
    const adlar = await caches?.keys();
    await Promise.all((adlar ?? []).map((ad) => caches.delete(ad)));
  } catch {
    // Önbellek erişimi kapalı olabilir; çıkış yine de yapılmalı.
  }
  await signOut({ callbackUrl: "/giris" });
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={cikis}
      className="min-h-touch w-full px-4 text-body text-red active:bg-surface-pressed"
    >
      Çıkış yap
    </button>
  );
}
