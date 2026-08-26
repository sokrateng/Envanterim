"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Group } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { ITEM_STATUS, ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";

/**
 * Ekipman silinmez; yaşam döngüsünden durumla çıkar (CLAUDE.md).
 * Servis ve maliyet geçmişi böylece kalır.
 *
 * Dört seçenek sürekli açıkken sayfanın altında beş satır yer kaplıyordu; oysa
 * durum yılda bir iki kez değişiyor. Artık tek satır mevcut durumu gösteriyor,
 * seçenekler dokununca açılıyor.
 */
export function StatusPicker({
  itemId,
  status,
}: {
  itemId: string;
  status: ItemStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: ItemStatus) {
    if (next === status) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/ekipman/${itemId}/durum`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Durum değiştirilemedi");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Group>
        {/* Row bağlantı üretiyor; burada eylem var, düğme kendi satırını
            çiziyor — düğme içinde bağlantı geçersiz biçimlendirme olurdu. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-touch w-full items-center gap-3 py-2.5 pl-4 pr-4 text-left active:bg-surface-pressed"
        >
          <span className="flex-1 text-body">Durum</span>
          <span className="shrink-0 text-subheadline text-muted">
            {ITEM_STATUS_LABELS[status]}
          </span>
          <span aria-hidden className="shrink-0 text-muted">
            ›
          </span>
        </button>
      </Group>

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Durum">
        <div className="overflow-hidden rounded-card bg-bg">
          {ITEM_STATUS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => change(option)}
              className="flex min-h-touch w-full items-center justify-between border-b border-separator px-4 text-body last:border-b-0 active:bg-surface-pressed disabled:opacity-50"
            >
              <span>{ITEM_STATUS_LABELS[option]}</span>
              {option === status ? <span className="text-blue">✓</span> : null}
            </button>
          ))}
        </div>
        <p className="pt-3 text-footnote text-muted">
          Ekipman silinmez: emekli ya da satıldı olarak işaretlenir, geçmişi
          kalır.
        </p>
      </Sheet>
    </>
  );
}
