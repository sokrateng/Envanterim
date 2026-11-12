"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Row, Rows } from "@/components/ui";
import { FormError } from "@/components/form";

export type BackupView = {
  health: "ok" | "stale" | "error" | "none";
  message: string;
  canRun: boolean;
  dir: string;
  lastAttempt: string | null;
  files: Array<{
    name: string;
    kind: "db" | "files";
    sizeLabel: string;
    whenLabel: string;
  }>;
};

const HEALTH: Record<
  BackupView["health"],
  { label: string; tone: "green" | "orange" | "red" | "muted" }
> = {
  ok: { label: "Güncel", tone: "green" },
  stale: { label: "Gecikmiş", tone: "orange" },
  error: { label: "Hata", tone: "red" },
  none: { label: "Yedek yok", tone: "muted" },
};

/**
 * Yedek durumu, "şimdi yedekle" ve dosya listesi. Renk tek başına bilgi
 * taşımıyor: durumun yanında yazılı etiketi ve açıklaması var.
 */
export function BackupPanel({ view }: { view: BackupView }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function backupNow() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/sistem/yedek", { method: "POST" });
    setPending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Yedek alınamadı");
    }
    // Hata olsa da durum dosyası değişmiş olabilir: ekranı tazele.
    router.refresh();
  }

  const health = HEALTH[view.health];

  return (
    <div>
      <Rows>
        <Row
          title="Durum"
          subtitle={view.message}
          trailing={<Badge tone={health.tone}>{health.label}</Badge>}
        />
        {view.lastAttempt ? (
          <Row title="Son çalışma" value={view.lastAttempt} />
        ) : null}
        <Row title="Klasör" value={view.dir} />
      </Rows>

      <div className="border-t border-separator px-4 py-3">
        {view.canRun ? (
          <button
            type="button"
            onClick={backupNow}
            disabled={pending}
            className="min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
          >
            {pending ? "Yedekleniyor…" : "Şimdi yedekle"}
          </button>
        ) : (
          <p className="text-footnote text-muted">
            Yedekleme betiği bu makinede yok; “Şimdi yedekle” yalnızca
            Raspberry Pi kurulumunda çalışır.
          </p>
        )}
        <FormError message={error} />
      </div>

      {view.files.length ? (
        <div className="border-t border-separator">
          <Rows>
            {view.files.map((file) => (
              <a
                key={file.name}
                href={`/api/sistem/yedek/${file.name}`}
                download
                className="flex min-h-touch items-center justify-between gap-3 px-4 py-2.5 active:bg-surface-pressed"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body">
                    {file.kind === "db" ? "Veritabanı" : "Yüklenen dosyalar"}
                  </span>
                  <span className="block text-footnote text-muted">
                    {file.whenLabel} · {file.sizeLabel}
                  </span>
                </span>
                <span className="shrink-0 text-footnote text-blue">İndir</span>
              </a>
            ))}
          </Rows>
        </div>
      ) : null}
    </div>
  );
}
