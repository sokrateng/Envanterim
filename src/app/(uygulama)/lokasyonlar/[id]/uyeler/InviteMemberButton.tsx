"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { ROLES, ROLE_LABELS } from "@/lib/constants";

export function InviteMemberButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/lokasyonlar/${locationId}/uyeler`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: String(form.get("username") ?? ""),
        role: String(form.get("role") ?? "VIEWER"),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Üye eklenemedi");
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
        + Üye
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Üye ekle">
        <form onSubmit={onSubmit}>
          <Field
            label="Kullanıcı adı"
            hint="Kişinin hesabı önceden açılmış olmalı; davet var olan kullanıcıya yapılır."
          >
            <input
              name="username"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              className={inputClass}
              placeholder="buketc"
            />
          </Field>
          <Field label="Rol">
            <select name="role" defaultValue="VIEWER" className={inputClass}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending}>Ekle</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
