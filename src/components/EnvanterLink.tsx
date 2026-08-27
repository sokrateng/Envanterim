"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inventoryHref, readFilters } from "@/lib/last-filter";

/**
 * Envanter listesine dönen bağlantı — kullanıcının bıraktığı süzmeyle.
 *
 * Düz bir `/envanter` bağlantısı sorguyu baştan yazıyor, yani süzülmüş listeden
 * bir ekipmana girip geri dönen kullanıcı süzmesini kaybediyordu (TUZAKLAR
 * #75). Donanım "geri"si doğru çalışıyordu, çünkü o geçmişteki adresi geri
 * getiriyor; ekrandaki geri düğmesi ise yeni bir gezinti.
 *
 * Saklanan süzme yalnız tarayıcıda okunabiliyor. `inventoryHref("")` zaten
 * "/envanter" verdiği için sunucu çizimi düz bağlantıyla birebir aynı;
 * bağlanmadan sonra adres tazeleniyor, uyuşmazlık olmuyor.
 */
export function EnvanterLink({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  /** Görsel bir düğmede metin yoksa erişilebilir ad. */
  label?: string;
}) {
  const [suzme, setSuzme] = useState("");
  useEffect(() => setSuzme(readFilters()), []);

  return (
    <Link href={inventoryHref(suzme)} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
