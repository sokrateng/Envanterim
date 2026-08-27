"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_STARS, filledStars, ratingSummary } from "@/lib/rating";

/**
 * Beğeni yıldızı.
 *
 * "Hangi makine gerçekten kullanılıyor?" sorusuna cevap: kişi başına tek puan,
 * ortalama herkese açık. Puan vermek üyeliğe bağlı — ekipmanı kullanan kişi
 * çoğu zaman düzenleyen değil.
 */
export function Rating({
  itemId,
  mine,
  count,
  average,
  canRate,
}: {
  itemId: string;
  /** Bu kullanıcının puanı; vermemişse null. */
  mine: number | null;
  count: number;
  average: number | null;
  canRate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rate(stars: number) {
    if (busy || !canRate) return;
    setBusy(true);
    setError(null);

    // Aynı yıldıza tekrar dokunmak puanı kaldırıyor: fikrini değiştiren
    // kullanıcı sıfırlayabilmeli.
    const response =
      stars === mine
        ? await fetch(`/api/ekipman/${itemId}/puan`, { method: "DELETE" })
        : await fetch(`/api/ekipman/${itemId}/puan`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ yildiz: stars }),
          });

    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Puan kaydedilemedi");
      return;
    }
    router.refresh();
  }

  // Kendi puanım varsa onu gösteriyorum: ortalamayı görünce kendi puanını
  // unutmak kolay, dokunduğunda ne olacağı belli olmalı.
  const shown = mine ?? filledStars(average);

  return (
    <section className="px-4 pt-3">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Beğeni puanı" className="flex">
          {Array.from({ length: MAX_STARS }, (_, index) => index + 1).map((star) => (
            <button
              key={star}
              type="button"
              disabled={!canRate || busy}
              onClick={() => void rate(star)}
              aria-label={`${star} yıldız ver`}
              aria-pressed={mine === star}
              className="min-h-touch px-1 text-[22px] leading-none disabled:opacity-100"
            >
              <span className={star <= shown ? "text-orange" : "text-separator"}>
                ★
              </span>
            </button>
          ))}
        </div>
        <span className="text-footnote text-muted">
          {ratingSummary(count, average)}
          {mine ? ` · senin puanın ${mine}` : ""}
        </span>
      </div>
      {error ? (
        <p role="alert" className="pt-1 text-footnote text-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
