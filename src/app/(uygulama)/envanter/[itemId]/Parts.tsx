"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { formatMoney } from "@/lib/money";

export type PartRow = {
  id: string;
  name: string;
  partNo: string | null;
  priceMinor: number | null;
  stock: number | null;
  vendorName: string | null;
};

export function Parts({
  itemId,
  parts,
  vendors,
  currency,
  editable,
}: {
  itemId: string;
  parts: PartRow[];
  vendors: Array<{ id: string; name: string }>;
  currency: string;
  editable: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/ekipman/${itemId}/parcalar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        partNo: text("partNo"),
        price: text("price"),
        vendorId: text("vendorId"),
        vendorName: text("vendorName"),
        stock: text("stock"),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Parça eklenemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  async function remove(partId: string) {
    const response = await fetch(`/api/parcalar/${partId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Parça silinemedi");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">Yedek parçalar</h2>
        {editable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-touch px-2 text-body text-blue active:opacity-60"
          >
            + Parça
          </button>
        ) : null}
      </div>

      {parts.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          Filtre, kayış, pil… Parça numarasını ve temin ücretini not edersen
          bir dahakine aramazsın.
        </p>
      ) : (
        <ul className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-surface">
          {parts.map((part) => {
            const details = [
              part.partNo ? `No ${part.partNo}` : null,
              part.vendorName,
              part.stock != null ? `Stok ${part.stock}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={part.id} className="flex min-h-touch items-center gap-3 py-2.5 pl-4 pr-4">
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-headline">{part.name}</span>
                  {details ? (
                    <span className="block truncate text-footnote text-muted">
                      {details}
                    </span>
                  ) : null}
                </div>
                {part.priceMinor != null ? (
                  <span className="shrink-0 text-subheadline text-muted">
                    {formatMoney(part.priceMinor, currency)}
                  </span>
                ) : null}
                {editable ? (
                  <button
                    type="button"
                    onClick={() => remove(part.id)}
                    className="min-h-touch px-2 text-subheadline text-red active:opacity-60"
                  >
                    Sil
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni parça">
        <form onSubmit={create} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Ad">
            <input name="name" required autoFocus className={inputClass} placeholder="Su filtresi" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Parça no">
              <input name="partNo" className={inputClass} placeholder="00634665" />
            </Field>
            <Field label="Stok">
              <input name="stock" inputMode="numeric" className={inputClass} placeholder="2" />
            </Field>
          </div>
          <Field label="Temin ücreti" hint="Örn. 450,00">
            <input name="price" inputMode="decimal" className={inputClass} placeholder="0,00" />
          </Field>
          <Field label="Nereden" hint="Listede yoksa aşağıya adını yaz.">
            <select name="vendorId" defaultValue="" className={inputClass}>
              <option value="">Seçilmedi</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Yeni firma">
            <input name="vendorName" className={inputClass} placeholder="Yedek Parça A.Ş." />
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </section>
  );
}
