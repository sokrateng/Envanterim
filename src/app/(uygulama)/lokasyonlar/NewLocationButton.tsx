"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

export function NewLocationButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/lokasyonlar", {
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
      setError(body.hata ?? "Lokasyon oluşturulamadı");
      return;
    }

    setOpen(false);
    router.refresh();
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

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni lokasyon">
        <form onSubmit={onSubmit}>
          <Field label="Ad">
            <input name="name" required autoFocus className={inputClass} placeholder="Ev" />
          </Field>
          <Field label="Simge" hint="Tek bir emoji — listede adın önünde görünür.">
            <input name="icon" className={inputClass} placeholder="🏠" maxLength={8} />
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending}>Oluştur</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
