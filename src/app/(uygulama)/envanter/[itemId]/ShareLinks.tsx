"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { SHARE_DURATIONS, type ShareState, SHARE_STATE_LABELS } from "@/lib/share";

export type ShareRow = {
  id: string;
  token: string;
  state: ShareState;
  remaining: string;
  viewCount: number;
};

/**
 * Salt-okunur paylaşım bağlantıları. Servise giderken teknisyene ürünün
 * geçmişini hesap açtırmadan göstermek için; tutarlar paylaşılmıyor.
 */
export function ShareLinks({
  itemId,
  links,
  editable,
}: {
  itemId: string;
  links: ShareRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState<number>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/ekipman/${itemId}/paylasim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gun: days }),
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Bağlantı üretilemedi");
      return;
    }
    router.refresh();
  }

  async function revoke(linkId: string) {
    setBusy(true);
    const response = await fetch(`/api/paylasim/${linkId}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "İptal edilemedi");
      return;
    }
    router.refresh();
  }

  async function share(token: string) {
    const url = `${window.location.origin}/p/${token}`;
    // Web Share API mobilde metni kaybettirmiyor (TUZAKLAR #11).
    if (navigator.share) {
      try {
        await navigator.share({ title: "Ekipman kaydı", url });
        return;
      } catch {
        // Kullanıcı vazgeçti; kopyalamaya düş.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
    } catch {
      setError("Kopyalanamadı, bağlantıyı elle al");
    }
  }

  return (
    <section className="mt-6">
      <h2 className="px-8 pb-2 text-footnote uppercase text-muted">
        Salt-okunur bağlantı
      </h2>

      {links.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          Servise giderken teknisyen ürünün geçmişini hesap açmadan görebilir.
          Tutarlar paylaşılmaz.
        </p>
      ) : (
        <ul className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-surface">
          {links.map((link) => (
            <li key={link.id} className="flex min-h-touch items-center gap-3 py-2.5 pl-4 pr-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="truncate text-subheadline">
                    /p/{link.token.slice(0, 8)}…
                  </code>
                  <Badge
                    tone={
                      link.state === "valid"
                        ? "green"
                        : link.state === "expired"
                          ? "orange"
                          : "muted"
                    }
                  >
                    {SHARE_STATE_LABELS[link.state]}
                  </Badge>
                </div>
                <div className="truncate text-footnote text-muted">
                  {link.remaining} · {link.viewCount} görüntüleme
                  {copied === link.token ? " · kopyalandı" : ""}
                </div>
              </div>

              {link.state === "valid" ? (
                <button
                  type="button"
                  onClick={() => share(link.token)}
                  className="min-h-touch px-2 text-subheadline text-blue active:opacity-60"
                >
                  Paylaş
                </button>
              ) : null}

              {editable && link.state === "valid" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(link.id)}
                  className="min-h-touch px-2 text-subheadline text-red active:opacity-60 disabled:opacity-50"
                >
                  İptal
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div className="mx-4 mt-3 flex gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            aria-label="Bağlantı süresi"
            className="min-h-touch flex-1 rounded-card border border-separator bg-surface px-3 text-subheadline"
          >
            {SHARE_DURATIONS.map((option) => (
              <option key={option.days} value={option.days}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={create}
            className="min-h-touch rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "…" : "Bağlantı üret"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
