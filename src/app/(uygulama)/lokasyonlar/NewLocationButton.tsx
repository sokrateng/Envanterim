"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { EmojiField } from "@/components/EmojiField";

export function NewLocationButton() {
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Öneriler yazılan ada göre sıralanıyor.
  const [name, setName] = useState("");

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

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni lokasyon">
        <form onSubmit={onSubmit}>
          <Field label="Ad">
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              className={inputClass}
              placeholder="Ev"
            />
          </Field>
          <EmojiField name="icon" set="location" nameValue={name} label="Simge" />
          <FormError message={error} />
          <SubmitButton pending={pending}>Oluştur</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
