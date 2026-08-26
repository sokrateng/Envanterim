"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { inputClass } from "@/components/form";

export type EmailState = {
  email: string | null;
  verified: boolean;
  reminders: boolean;
};

/**
 * E-posta bildirimi ayarı. Adres doğrulanmadan bildirim gitmiyor: yanlış
 * yazılmış bir adrese envanter bilgisi gönderilmesin.
 */
export function EmailSettings({ state }: { state: EmailState }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function call(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);

    const response = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "İşlem tamamlanamadı");
      return false;
    }
    router.refresh();
    return true;
  }

  async function addEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInfo(null);
    const ok = await call("POST", "/api/hesap/eposta", { email });
    if (ok) {
      setInfo("Kod gönderildi, gelen kutuna bak");
      setEmail("");
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInfo(null);
    const ok = await call("POST", "/api/hesap/eposta/dogrula", { kod: code });
    if (ok) {
      setInfo("Adres doğrulandı");
      setCode("");
    }
  }

  return (
    <div className="px-4 py-2.5">
      {state.email ? (
        <>
          <div className="flex min-h-touch items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-body">{state.email}</span>
                <Badge tone={state.verified ? "green" : "orange"}>
                  {state.verified ? "Doğrulandı" : "Doğrulanmadı"}
                </Badge>
              </div>
              <span className="block text-footnote text-muted">
                {state.verified
                  ? "Garanti ve bakım hatırlatmaları bu adrese de gelir."
                  : "Gelen koddaki altı haneyi gir."}
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => call("DELETE", "/api/hesap/eposta")}
              className="min-h-touch shrink-0 px-2 text-subheadline text-red active:opacity-60 disabled:opacity-50"
            >
              Kaldır
            </button>
          </div>

          {state.verified ? (
            <label className="flex min-h-touch items-center justify-between gap-3 pt-2">
              <span className="text-body">E-posta ile hatırlat</span>
              <input
                type="checkbox"
                checked={state.reminders}
                disabled={busy}
                onChange={(event) =>
                  call("PATCH", "/api/hesap/eposta", {
                    hatirlatma: event.target.checked,
                  })
                }
                className="h-6 w-6 accent-[var(--ios-blue)]"
              />
            </label>
          ) : (
            <form onSubmit={verify} className="flex gap-2 pt-2">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                aria-label="Doğrulama kodu"
                className={`${inputClass} tracking-[0.3em]`}
              />
              <button
                type="submit"
                disabled={busy}
                className="min-h-touch shrink-0 rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
              >
                Doğrula
              </button>
            </form>
          )}
        </>
      ) : (
        <form onSubmit={addEmail}>
          <span className="block text-body">E-posta bildirimi</span>
          <span className="block pb-2 text-footnote text-muted">
            Bildirim açık olmayan cihazlarda da haberin olsun.
          </span>
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="sen@ornek.com"
              aria-label="E-posta adresi"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-touch shrink-0 rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
            >
              Ekle
            </button>
          </div>
        </form>
      )}

      {info ? (
        <p className="pt-2 text-footnote text-green" role="status">
          {info}
        </p>
      ) : null}
      {error ? (
        <p className="pt-2 text-footnote text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
