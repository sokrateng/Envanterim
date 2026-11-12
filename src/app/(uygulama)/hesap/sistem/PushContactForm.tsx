"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

const SOURCE_LABEL: Record<"ekran" | "env" | "varsayilan", string> = {
  ekran: "Bu ekrandan girildi",
  env: "Sunucudaki .env dosyasından geliyor",
  varsayilan: "Örnek adres kullanılıyor — kendi adresini gir",
};

/** Push iletişim adresi. Düz e-posta yazılır; `mailto:` kendiliğinden eklenir. */
export function PushContactForm({
  current,
  source,
}: {
  current: string;
  source: "ekran" | "env" | "varsayilan";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/sistem/iletisim", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adres: String(form.get("adres") ?? "") }),
    });
    setPending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Adres kaydedilemedi");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function reset() {
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch("/api/sistem/iletisim", { method: "DELETE" });
    setPending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Adres sıfırlanamadı");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="px-4 pb-4 pt-2">
      <Field
        label="İletişim adresi"
        hint={`Şu an: ${current} · ${SOURCE_LABEL[source]}`}
      >
        {/* Anahtar adres değişince form yeniden kuruluyor: kaydedilen değer
            alana yansısın, eski yazı kalmasın. */}
        <input
          key={current}
          name="adres"
          type="text"
          inputMode="email"
          autoComplete="off"
          placeholder="ben@ornek.com"
          defaultValue={source === "ekran" ? current.replace(/^mailto:/, "") : ""}
          required
          className={inputClass}
        />
      </Field>
      <FormError message={error} />
      {saved ? (
        <p role="status" className="pt-2 text-footnote text-green">
          Kaydedildi. Sonraki bildirimden itibaren geçerli.
        </p>
      ) : null}
      <SubmitButton pending={pending}>Kaydet</SubmitButton>
      {source === "ekran" ? (
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="mt-2 min-h-touch w-full text-footnote text-muted active:opacity-60 disabled:opacity-50"
        >
          Ekrandaki adresi sil
        </button>
      ) : null}
    </form>
  );
}
