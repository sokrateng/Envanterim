"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { useCloseAndRefresh } from "@/lib/history-layer";

export type ComponentRow = {
  id: string;
  name: string;
  detail: string | null;
};

/**
 * Alt ekipmanlar. iPhone'un Claude aboneliği, bilgisayarın klavyesi —
 * kendi garantisi ve faturası olan tam birer ekipman, yalnız bir ana
 * ekipmanla birlikte geziyorlar.
 */
export function Components({
  itemId,
  parent,
  components,
  linkable,
  editable,
}: {
  itemId: string;
  parent: { id: string; name: string } | null;
  components: ComponentRow[];
  linkable: Array<{ id: string; name: string }>;
  editable: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link(childId: string, parentId: string | null) {
    setError(null);
    const response = await fetch(`/api/ekipman/${childId}/ana`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Bağlanamadı");
      return false;
    }
    return true;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const form = new FormData(event.currentTarget);
    const ok = await link(String(form.get("childId") ?? ""), itemId);
    setPending(false);
    if (ok) closeAndRefresh(() => setOpen(false));
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">Bileşenler</h2>
        {editable && linkable.length ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-touch px-2 text-body text-blue active:opacity-60"
          >
            + Bileşen
          </button>
        ) : null}
      </div>

      {parent ? (
        <div className="mx-4 mb-2 flex min-h-touch items-center gap-3 rounded-card bg-surface px-4 py-2.5">
          <span className="shrink-0 text-footnote text-muted">Şunun parçası</span>
          <Link
            href={`/envanter/${parent.id}`}
            className="min-w-0 flex-1 truncate text-headline text-blue active:opacity-60"
          >
            {parent.name}
          </Link>
          {editable ? (
            <button
              type="button"
              onClick={async () => {
                if (await link(itemId, null)) router.refresh();
              }}
              className="min-h-touch shrink-0 px-2 text-subheadline text-red active:opacity-60"
            >
              Ayır
            </button>
          ) : null}
        </div>
      ) : null}

      {components.length ? (
        <ul className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-surface">
          {components.map((component) => (
            <li key={component.id} className="flex min-h-touch items-center gap-3 px-4 py-2.5">
              <Link
                href={`/envanter/${component.id}`}
                className="min-w-0 flex-1 active:opacity-60"
              >
                <span className="block truncate text-headline">{component.name}</span>
                {component.detail ? (
                  <span className="block truncate text-footnote text-muted">
                    {component.detail}
                  </span>
                ) : null}
              </Link>
              {editable ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (await link(component.id, null)) router.refresh();
                  }}
                  className="min-h-touch shrink-0 px-2 text-subheadline text-red active:opacity-60"
                >
                  Ayır
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : parent ? null : (
        <p className="px-8 text-footnote text-muted">
          Lisans, hoparlör, klavye… Ana ekipmanla birlikte gezen her şeyi buraya
          bağla; zimmet ve devir birlikte işler.
        </p>
      )}

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Bileşen bağla" guardUnsaved>
        <form onSubmit={add} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field
            label="Ekipman"
            hint="Aynı lokasyondaki, başka bir ekipmana bağlı olmayanlar."
          >
            <select name="childId" defaultValue="" className={inputClass} required>
              <option value="" disabled>
                Seç
              </option>
              {linkable.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending}>Bağla</SubmitButton>
        </form>
      </Sheet>
    </section>
  );
}
