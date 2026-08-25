"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import {
  ItemFields,
  collectCustomFields,
  type CategoryOption,
  type VendorOption,
} from "@/components/ItemFields";

export function NewItemButton({
  locations,
  defaultLocationId,
  categoriesByLocation,
  vendorsByLocation,
}: {
  locations: Array<{ id: string; name: string }>;
  defaultLocationId: string;
  categoriesByLocation: Record<string, CategoryOption[]>;
  vendorsByLocation: Record<string, VendorOption[]>;
}) {
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(defaultLocationId);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/lokasyonlar/${locationId}/ekipman`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        categoryId: text("categoryId"),
        sellerId: text("sellerId"),
        sellerName: text("sellerName"),
        brand: text("brand"),
        model: text("model"),
        serialNo: text("serialNo"),
        place: text("place"),
        purchaseDate: text("purchaseDate"),
        purchasePrice: text("purchasePrice"),
        warrantyEndDate: text("warrantyEndDate"),
        status: text("status") || "IN_USE",
        customFields: collectCustomFields(form),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Ekipman eklenemedi");
      return;
    }

    closeAndRefresh(() => setOpen(false));
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
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className={inputClass}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {/* Lokasyon değişince kategori seçimi sıfırlansın: kategoriler
              lokasyona ait, önceki seçim başka lokasyonunki olurdu. */}
          <ItemFields
            key={locationId}
            categories={categoriesByLocation[locationId] ?? []}
            vendors={vendorsByLocation[locationId] ?? []}
          />

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
