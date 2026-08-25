"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

export function RegisterForm({ defaultCode }: { defaultCode: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    const response = await fetch("/api/kayit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: String(form.get("code") ?? ""),
        name: String(form.get("name") ?? ""),
        username,
        password,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setPending(false);
      setError(body.hata ?? "Hesap açılamadı");
      return;
    }

    // Kayıttan sonra kullanıcıyı tekrar giriş ekranına düşürmeyelim.
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setPending(false);

    if (!result || result.error) {
      router.replace("/giris");
      return;
    }
    router.replace("/lokasyonlar");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="pt-8">
      <Field label="Davet kodu">
        <input
          name="code"
          defaultValue={defaultCode}
          required
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClass} tracking-[0.2em]`}
          placeholder="ABCD-EFGH-JK"
        />
      </Field>
      <Field label="Ad soyad">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Kullanıcı adı" hint="Harf, rakam, nokta, tire ve alt çizgi.">
        <input
          name="username"
          required
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          className={inputClass}
        />
      </Field>
      <Field label="Şifre" hint="En az 8 karakter.">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending}>Hesabı aç</SubmitButton>
    </form>
  );
}
