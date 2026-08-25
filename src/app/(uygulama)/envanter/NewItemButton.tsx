"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { ITEM_STATUS, ITEM_STATUS_LABELS } from "@/lib/constants";

export function NewItemButton({
  locations,
  defaultLocationId,
}: {
  locations: Array<{ id: string; name: string }>;
  defaultLocationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const locationId = String(form.get("locationId") ?? defaultLocationId);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/lokasyonlar/${locationId}/ekipman`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        brand: text("brand"),
        model: text("model"),
        serialNo: text("serialNo"),
        place: text("place"),
        purchaseDate: text("purchaseDate"),
        purchasePrice: text("purchasePrice"),
        warrantyEndDate: text("warrantyEndDate"),
        status: text("status") || "IN_USE",
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Ekipman eklenemedi");
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
        aria-label="Ekipman ekle"
      >
        + Yeni
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni ekipman">
        <form onSubmit={onSubmit} className="max-h-[70dvh] overflow-y-auto pb-2">
          {locations.length > 1 ? (
            <Field label="Lokasyon">
              <select
                name="locationId"
                defaultValue={defaultLocationId}
                className={inputClass}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="locationId" value={defaultLocationId} />
          )}

          <Field label="Ad">
            <input name="name" required autoFocus className={inputClass} placeholder="Çamaşır makinesi" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marka">
              <input name="brand" className={inputClass} />
            </Field>
            <Field label="Model">
              <input name="model" className={inputClass} />
            </Field>
          </div>

          <Field label="Seri no">
            <input name="serialNo" autoCapitalize="characters" className={inputClass} />
          </Field>

          <Field label="Yer" hint="Oda, raf, kat — serbest metin.">
            <input name="place" className={inputClass} placeholder="Mutfak" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Alış tarihi">
              <input type="date" name="purchaseDate" className={inputClass} />
            </Field>
            <Field label="Garanti bitişi">
              <input type="date" name="warrantyEndDate" className={inputClass} />
            </Field>
          </div>

          <Field label="Alış tutarı" hint="Örn. 18.400,50">
            <input
              name="purchasePrice"
              inputMode="decimal"
              className={inputClass}
              placeholder="0,00"
            />
          </Field>

          <Field label="Durum">
            <select name="status" defaultValue="IN_USE" className={inputClass}>
              {ITEM_STATUS.map((status) => (
                <option key={status} value={status}>
                  {ITEM_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
