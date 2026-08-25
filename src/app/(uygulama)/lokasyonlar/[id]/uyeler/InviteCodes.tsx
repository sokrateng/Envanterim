"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { Badge } from "@/components/ui";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { INVITE_STATE_LABELS, type InviteState } from "@/lib/invite";

export type InviteView = {
  id: string;
  code: string;
  role: Role;
  state: InviteState;
  expiresAt: string;
  usedBy: string | null;
};

export function InviteCodes({
  locationId,
  invites,
}: {
  locationId: string;
  invites: InviteView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/lokasyonlar/${locationId}/davetler`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: String(form.get("role") ?? "VIEWER") }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Davet kodu üretilemedi");
      return;
    }

    const invite = (await response.json()) as { code: string };
    setFresh(invite.code);
    router.refresh();
  }

  async function revoke(inviteId: string) {
    const response = await fetch(
      `/api/lokasyonlar/${locationId}/davetler/${inviteId}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Davet iptal edilemedi");
      return;
    }
    router.refresh();
  }

  function close() {
    setOpen(false);
    setFresh(null);
    setError(null);
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">Davet kodları</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-touch px-2 text-body text-blue active:opacity-60"
        >
          + Davet
        </button>
      </div>

      <Sheet open={open} onClose={close} title="Davet kodu">
        {fresh ? (
          <FreshCode code={fresh} onDone={close} />
        ) : (
          <form onSubmit={create}>
            <Field
              label="Rol"
              hint="Kod tek kullanımlık ve 7 gün geçerli. Kullanan kişi bu rolle üye olur."
            >
              <select name="role" defaultValue="VIEWER" className={inputClass}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </Field>
            <FormError message={error} />
            <SubmitButton pending={pending}>Kod üret</SubmitButton>
          </form>
        )}
      </Sheet>

      {invites.length ? (
        <ul className="mx-4 overflow-hidden rounded-card bg-surface divide-y divide-separator">
          {invites.map((invite) => (
            <li key={invite.id} className="flex min-h-touch items-center gap-3 py-2.5 pl-4 pr-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="truncate text-headline tracking-[0.15em]">
                    {invite.code}
                  </code>
                  <Badge
                    tone={
                      invite.state === "valid"
                        ? "green"
                        : invite.state === "used"
                          ? "muted"
                          : "orange"
                    }
                  >
                    {INVITE_STATE_LABELS[invite.state]}
                  </Badge>
                </div>
                <div className="truncate text-footnote text-muted">
                  {ROLE_LABELS[invite.role]}
                  {invite.usedBy ? ` · ${invite.usedBy}` : ` · ${invite.expiresAt}`}
                </div>
              </div>
              {invite.state !== "used" ? (
                <button
                  type="button"
                  onClick={() => revoke(invite.id)}
                  className="min-h-touch px-2 text-subheadline text-red active:opacity-60"
                >
                  İptal
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {invites.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          Hesabı olmayan birini davet etmek için kod üret; kodla kayıt olan kişi
          doğrudan bu lokasyona üye olur.
        </p>
      ) : null}
      {error && !open ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function FreshCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/kayit?kod=${code}`;

  async function share() {
    // Web Share API mobilde metni kaybettirmiyor (TUZAKLAR #11).
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Envanterim daveti", text: code, url: link });
        return;
      } catch {
        // Kullanıcı vazgeçti; kopyalamaya düş.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Bağlantı kopyalandı");
    } catch {
      setCopied("Kopyalanamadı, kodu elle yaz");
    }
  }

  return (
    <div className="pb-2">
      <p className="pt-2 text-footnote text-muted">
        Kodu davet ettiğin kişiye ver. Tek kullanımlık, 7 gün geçerli.
      </p>
      <p className="py-4 text-center text-large-title tracking-[0.2em]">{code}</p>
      <button
        type="button"
        onClick={share}
        className="min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95"
      >
        Paylaş
      </button>
      {copied ? (
        <p className="pt-2 text-center text-footnote text-muted">{copied}</p>
      ) : null}
      <button
        type="button"
        onClick={onDone}
        className="mt-2 min-h-touch w-full text-body text-blue active:opacity-60"
      >
        Bitti
      </button>
    </div>
  );
}
