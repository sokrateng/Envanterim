"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { EmojiField } from "@/components/EmojiField";
import { useCloseAndRefresh } from "@/lib/history-layer";

/**
 * Lokasyon adı/ikonu ve kapatma. Yalnız sahip görüyor.
 *
 * Silme boş lokasyona özel: ekipman silinmiyor (CLAUDE.md), dolayısıyla dolu
 * bir lokasyon kapanmıyor — sunucu da aynı kuralı uyguluyor, düğmenin gizli
 * olması tek savunma değil.
 */
export function EditLocation({
  id,
  name,
  icon,
  itemCount,
}: {
  id: string;
  name: string;
  icon: string | null;
  itemCount: number;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [draftName, setDraftName] = useState(name);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/lokasyonlar/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        icon: String(form.get("icon") ?? ""),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Kaydedilemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  async function remove() {
    setPending(true);
    const response = await fetch(`/api/lokasyonlar/${id}`, { method: "DELETE" });
    setPending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Silinemedi");
      setConfirming(false);
      return;
    }
    router.push("/lokasyonlar");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-touch px-2 text-body text-blue active:opacity-60"
      >
        Düzenle
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Lokasyon" guardUnsaved>
        <form onSubmit={save} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Ad">
            <input
              name="name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <EmojiField
            name="icon"
            defaultValue={icon}
            set="location"
            nameValue={draftName}
          />
          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>

        <div className="border-t border-separator px-4 pt-3">
          {itemCount > 0 ? (
            <p className="pb-2 text-footnote text-muted">
              Bu lokasyonda {itemCount} ekipman var. Ekipman silinmediği için
              (geçmişi kaybolmasın diye) dolu lokasyon da kapatılamıyor.
            </p>
          ) : confirming ? (
            <div className="flex gap-2 pb-2">
              <button
                type="button"
                disabled={pending}
                onClick={remove}
                className="min-h-touch flex-1 rounded-card bg-red px-3 text-headline text-white transition active:scale-95 disabled:opacity-50"
              >
                Evet, sil
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-touch flex-1 rounded-card bg-bg px-3 text-headline text-blue transition active:scale-95"
              >
                Vazgeç
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-touch w-full pb-2 text-left text-body text-red active:opacity-60"
            >
              Lokasyonu sil
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}
