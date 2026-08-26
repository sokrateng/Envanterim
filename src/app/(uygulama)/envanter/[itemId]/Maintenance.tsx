"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Badge } from "@/components/ui";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { useCloseAndRefresh } from "@/lib/history-layer";
import type { RuleState } from "@/lib/maintenance";

export type MaintenanceRow = {
  id: string;
  name: string;
  /** Sunucuda hesaplanmış durum metni; hesap `src/lib/maintenance.ts`'te. */
  text: string;
  state: RuleState;
  every: string;
};

const TONE: Record<RuleState, "red" | "orange" | "green" | "muted"> = {
  due: "red",
  soon: "orange",
  ok: "green",
  unknown: "muted",
};

const LABEL: Record<RuleState, string> = {
  due: "Zamanı geldi",
  soon: "Yaklaşıyor",
  ok: "Zamanı var",
  unknown: "Veri eksik",
};

export function Maintenance({
  itemId,
  rules,
  editable,
}: {
  itemId: string;
  rules: MaintenanceRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [basis, setBasis] = useState<"time" | "reading">("time");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/ekipman/${itemId}/bakim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        everyMonths: basis === "time" ? text("everyMonths") : "",
        everyReading: basis === "reading" ? text("everyReading") : "",
        readingUnit: basis === "reading" ? text("readingUnit") : "",
        leadDays: text("leadDays") || "7",
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Bakım kuralı eklenemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  async function remove(ruleId: string) {
    const response = await fetch(`/api/bakim/${ruleId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Kural silinemedi");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">Bakım</h2>
        {editable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-touch px-2 text-body text-blue active:opacity-60"
          >
            + Kural
          </button>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          &quot;6 ayda bir klima bakımı&quot; ya da &quot;her 10.000 km&apos;de
          servis&quot;. Zamanı gelince bildirim gelir.
        </p>
      ) : (
        <ul className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-surface">
          {rules.map((rule) => (
            <li key={rule.id} className="flex min-h-touch items-center gap-3 py-2.5 pl-4 pr-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-headline">{rule.name}</span>
                  <Badge tone={TONE[rule.state]}>{LABEL[rule.state]}</Badge>
                </div>
                <div className="truncate text-footnote text-muted">
                  {rule.every} · {rule.text}
                </div>
              </div>
              {editable ? (
                <button
                  type="button"
                  onClick={() => remove(rule.id)}
                  className="min-h-touch px-2 text-subheadline text-red active:opacity-60"
                >
                  Sil
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Bakım kuralı">
        <form onSubmit={create} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Ad">
            <input name="name" required autoFocus className={inputClass} placeholder="Klima bakımı" />
          </Field>

          <Field label="Neye göre tekrarlasın">
            <select
              value={basis}
              onChange={(event) => setBasis(event.target.value as "time" | "reading")}
              className={inputClass}
            >
              <option value="time">Zamana göre</option>
              <option value="reading">Sayaca göre</option>
            </select>
          </Field>

          {basis === "time" ? (
            <Field label="Kaç ayda bir" hint="Son servisten sayılır; servis yoksa alış tarihinden.">
              <input
                name="everyMonths"
                inputMode="numeric"
                required
                className={inputClass}
                placeholder="6"
              />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Her kaç birimde">
                <input
                  name="everyReading"
                  inputMode="decimal"
                  required
                  className={inputClass}
                  placeholder="10000"
                />
              </Field>
              <Field label="Birim">
                <input name="readingUnit" className={inputClass} placeholder="km" />
              </Field>
            </div>
          )}

          <Field label="Kaç gün önceden haber" hint="Yalnız zamana göre kurallarda.">
            <input name="leadDays" inputMode="numeric" defaultValue="7" className={inputClass} />
          </Field>

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </section>
  );
}
