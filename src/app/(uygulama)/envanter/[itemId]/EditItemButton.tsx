"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { FormError, SubmitButton } from "@/components/form";
import {
  ItemFields,
  collectCustomFields,
  type CategoryOption,
  type ItemDefaults,
} from "@/components/ItemFields";

export function EditItemButton({
  itemId,
  categories,
  defaults,
}: {
  itemId: string;
  categories: CategoryOption[];
  defaults: ItemDefaults;
}) {
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/ekipman/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        categoryId: text("categoryId"),
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
      setError(body.hata ?? "Ekipman güncellenemedi");
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
      >
        Düzenle
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Ekipmanı düzenle">
        <form onSubmit={onSubmit} className="max-h-[70dvh] overflow-y-auto pb-2">
          <ItemFields categories={categories} defaults={defaults} />
          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
