"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ITEM_STATUS, ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";

/**
 * Ekipman silinmez; yaşam döngüsünden durumla çıkar (CLAUDE.md).
 * Servis ve maliyet geçmişi böylece kalır.
 */
export function StatusPicker({
  itemId,
  status,
}: {
  itemId: string;
  status: ItemStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: ItemStatus) {
    if (next === status) return;
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
    router.refresh();
  }

  return (
    <section className="mt-6">
      <h2 className="px-8 pb-2 text-footnote uppercase text-muted">Durum</h2>
      <div className="mx-4 overflow-hidden rounded-card bg-surface divide-y divide-separator">
        {ITEM_STATUS.map((option) => (
          <button
            key={option}
            type="button"
            disabled={busy}
            onClick={() => change(option)}
            className="flex min-h-touch w-full items-center justify-between px-4 text-body active:bg-surface-pressed disabled:opacity-50"
          >
            <span>{ITEM_STATUS_LABELS[option]}</span>
            {option === status ? <span className="text-blue">✓</span> : null}
          </button>
        ))}
      </div>
      <p className="px-8 pt-2 text-footnote text-muted">
        Ekipman silinmez: emekli ya da satıldı olarak işaretlenir, geçmişi kalır.
      </p>
      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
