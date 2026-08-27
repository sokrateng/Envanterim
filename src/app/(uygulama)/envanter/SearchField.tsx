"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Ada, markaya, modele ve seri numarasına göre arama. */
export function SearchField({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (value === (params.get("q") ?? "")) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      // Yeni aramada üçüncü sayfada kalmak boş liste gösterir.
      next.delete("sayfa");
      router.replace(`${pathname}?${next.toString()}`);
    }, 250);

    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <input
      type="search"
      inputMode="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Ara: ad, marka, model, seri no"
      aria-label="Envanterde ara"
      /* Kenarlıklı kutu yerine dolgulu alan: iOS arama alanı böyle ve
         listenin kart yüzeyiyle karışmıyor. */
      className="min-h-touch w-full rounded-card bg-surface-pressed px-3 text-body outline-none placeholder:text-muted"
    />
  );
}
