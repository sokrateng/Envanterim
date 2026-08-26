"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

/** Şifre değiştirme. Mevcut şifre soruluyor — açık kalan telefon yetmesin. */
export function PasswordChange() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/hesap/sifre", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mevcut: String(form.get("mevcut") ?? ""),
        yeni: String(form.get("yeni") ?? ""),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Şifre değiştirilemedi");
      return;
    }

    setDone(true);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        className="flex min-h-touch w-full items-center justify-between px-4 py-2.5 text-left active:bg-surface-pressed"
      >
        <span className="text-body">Şifre değiştir</span>
        <span className="text-footnote text-muted" aria-hidden>
          ›
        </span>
      </button>

      {done ? (
        <p role="status" className="px-4 pb-2 text-footnote text-green">
          Şifre değişti.
        </p>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Şifre değiştir">
        <form onSubmit={save} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Mevcut şifre">
            <input
              name="mevcut"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Yeni şifre" hint="En az 8 karakter.">
            <input
              name="yeni"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
