"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });

    setPending(false);
    if (!result || result.error) {
      // Hangisinin yanlış olduğunu söylemiyoruz: kullanıcı adı sızmasın.
      setError("Kullanıcı adı ya da şifre hatalı");
      return;
    }
    router.replace("/lokasyonlar");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="pt-8">
      <Field label="Kullanıcı adı">
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Şifre">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending}>Giriş yap</SubmitButton>
      <p className="pt-4 text-footnote text-muted">
        Hesabın yoksa seni bir lokasyona davet eden kişiden hesap açmasını iste.
        İlk hesap <code>npm run create-admin</code> ile açılır.
      </p>
    </form>
  );
}
