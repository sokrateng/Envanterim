"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { Badge } from "@/components/ui";
import { FIELD_TYPES, FIELD_TYPE_LABELS } from "@/lib/constants";

export type FieldView = {
  id: string;
  key: string;
  label: string;
  typeLabel: string;
  required: boolean;
  hidden: boolean;
  options: string[];
};

export function CategoryFields({
  locationId,
  categoryId,
  fields,
}: {
  locationId: string;
  categoryId: string;
  fields: FieldView[];
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>("TEXT");
  // Düzenlenen alan; tip ve seçenekler değişmiyor (girilmiş değerleri bozardı).
  const [editing, setEditing] = useState<FieldView | null>(null);

  const base = `/api/lokasyonlar/${locationId}/kategoriler/${categoryId}/alanlar`;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") ?? ""),
        type: String(form.get("type") ?? "TEXT"),
        required: form.get("required") === "on",
        options: String(form.get("options") ?? ""),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Alan eklenemedi");
      return;
    }

    setType("TEXT");
    closeAndRefresh(() => setOpen(false));
  }

  async function saveField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`${base}/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") ?? ""),
        required: form.get("required") === "on",
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Alan güncellenemedi");
      return;
    }
    closeAndRefresh(() => setEditing(null));
  }

  async function toggleHidden(field: FieldView) {
    const response = await fetch(`${base}/${field.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hidden: !field.hidden }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Alan güncellenemedi");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">Özel alanlar</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-touch px-2 text-body text-blue active:opacity-60"
        >
          + Alan
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          Bu kategoriye özel alan yok. Ekran boyutu, yakıt tipi, şase no gibi
          alanlar tanımlayabilirsin.
        </p>
      ) : (
        <ul className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-surface">
          {fields.map((field) => (
            <li key={field.id} className="flex min-h-touch items-center gap-3 py-2.5 pl-4 pr-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-headline">{field.label}</span>
                  {field.required ? <Badge tone="blue">Zorunlu</Badge> : null}
                  {field.hidden ? <Badge tone="muted">Gizli</Badge> : null}
                </div>
                <div className="truncate text-footnote text-muted">
                  {field.typeLabel}
                  {field.options.length ? ` · ${field.options.join(", ")}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(field)}
                className="min-h-touch shrink-0 px-2 text-subheadline text-blue active:opacity-60"
              >
                Düzenle
              </button>
              <button
                type="button"
                onClick={() => toggleHidden(field)}
                className="min-h-touch shrink-0 px-2 text-subheadline text-muted active:opacity-60"
              >
                {field.hidden ? "Göster" : "Gizle"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="px-8 pt-2 text-footnote text-muted">
        Alan silinmez, gizlenir: silmek girilmiş değerleri silmiyor, yalnız
        görünmez yapıyor olurdu. Gizli alanın değeri korunur.
      </p>

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni alan">
        <form onSubmit={create} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Alan adı">
            <input name="label" required autoFocus className={inputClass} placeholder="Ekran boyutu" />
          </Field>
          <Field label="Tip">
            <select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={inputClass}
            >
              {FIELD_TYPES.map((option) => (
                <option key={option} value={option}>
                  {FIELD_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
          {type === "SELECT" ? (
            <Field label="Seçenekler" hint="Her satıra bir seçenek.">
              <textarea
                name="options"
                rows={4}
                className={inputClass}
                placeholder={"Benzin\nDizel\nElektrik"}
              />
            </Field>
          ) : null}
          <label className="flex min-h-touch items-center justify-between gap-3 py-2">
            <span className="text-body">Zorunlu</span>
            <input type="checkbox" name="required" className="h-6 w-6 accent-[var(--ios-blue)]" />
          </label>
          <FormError message={error} />
          <SubmitButton pending={pending}>Ekle</SubmitButton>
        </form>
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Alanı düzenle"
      >
        {editing ? (
          <form onSubmit={saveField} className="max-h-[70dvh] overflow-y-auto pb-2">
            <Field label="Alan adı">
              <input
                name="label"
                defaultValue={editing.label}
                required
                autoFocus
                className={inputClass}
              />
            </Field>
            <label className="flex min-h-touch items-center justify-between gap-3 py-2">
              <span className="text-body">Zorunlu</span>
              <input
                type="checkbox"
                name="required"
                defaultChecked={editing.required}
                className="h-6 w-6 accent-[var(--ios-blue)]"
              />
            </label>
            <p className="pb-2 text-footnote text-muted">
              Tip ({editing.typeLabel}) ve seçenekler değiştirilmiyor: girilmiş
              değerler o tipe göre kaydedildi, sonradan değiştirmek onları
              okunamaz hâle getirirdi. Yeni bir alan açıp eskisini gizleyebilirsin.
            </p>
            <FormError message={error} />
            <SubmitButton pending={pending}>Kaydet</SubmitButton>
          </form>
        ) : null}
      </Sheet>
    </section>
  );
}
