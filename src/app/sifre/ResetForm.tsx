"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

/**
 * Şifre sıfırlama. İki adım tek ekranda: önce kod istenir, sonra kodla yeni
 * şifre konur.
 *
 * Sunucu hiçbir zaman "böyle kullanıcı yok" demiyor; ekran da aynı dili
 * konuşuyor — kullanıcı adı sızdırmak, unutulan şifreden büyük dert.
 */
export function ResetForm() {
  const router = useRouter();
  const [step, setStep] = useState<"iste" | "kod">("iste");
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function request(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/sifre-sifirla", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setPending(false);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.hata ?? "İstek gönderilemedi");
      return;
    }
    setInfo(payload.bilgi ?? "Kod gönderildi.");
    setStep("kod");
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/sifre-sifirla", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        kod: String(form.get("kod") ?? ""),
        yeni: String(form.get("yeni") ?? ""),
      }),
    });
    setPending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Şifre değiştirilemedi");
      return;
    }
    router.replace("/giris?sifirlandi=1");
  }

  if (step === "iste") {
    return (
      <form onSubmit={request} className="pt-8">
        <Field
          label="Kullanıcı adı"
          hint="Hesabına bağlı doğrulanmış adrese kod gönderilir."
        >
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            className={inputClass}
          />
        </Field>
        <FormError message={error} />
        <SubmitButton pending={pending}>Kod gönder</SubmitButton>
        <p className="pt-4 text-footnote text-muted">
          <Link href="/giris" className="text-blue">
            Girişe dön
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={confirm} className="pt-8">
      {info ? (
        <p role="status" className="pb-4 text-footnote text-muted">
          {info}
        </p>
      ) : null}
      <Field label="Koddaki altı hane">
        <input
          name="kod"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
          className={`${inputClass} tracking-[0.3em]`}
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
      <SubmitButton pending={pending}>Şifreyi değiştir</SubmitButton>
      <button
        type="button"
        onClick={() => setStep("iste")}
        className="min-h-touch w-full pt-4 text-footnote text-blue active:opacity-60"
      >
        Kod gelmedi, yeniden iste
      </button>
    </form>
  );
}
