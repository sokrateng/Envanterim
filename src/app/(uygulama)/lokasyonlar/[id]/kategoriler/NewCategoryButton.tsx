"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

export function NewCategoryButton({ locationId }: { locationId: string }) {
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/lokasyonlar/${locationId}/kategoriler`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        icon: String(form.get("icon") ?? ""),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Kategori oluşturulamadı");
      return;
    }

    closeAndRefresh(() => setOpen(false));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-touch px-2 text-body text-blue active:opacity-60"
      >
        + Yeni
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni kategori">
        <form onSubmit={onSubmit}>
          <Field label="Ad">
            <input name="name" required autoFocus className={inputClass} placeholder="Beyaz eşya" />
          </Field>
          <Field label="Simge" hint="Tek bir emoji.">
            <input name="icon" maxLength={8} className={inputClass} placeholder="🧺" />
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending}>Oluştur</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
