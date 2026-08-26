"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmojiField } from "@/components/EmojiField";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { useCloseAndRefresh } from "@/lib/history-layer";

/**
 * Kategori adı ve simgesi. Silme burada yok: kategoriye bağlı ekipmanlar
 * kategorisiz kalırdı — ad düzeltmek istenen şeyin kendisi zaten.
 */
export function EditCategory({
  locationId,
  categoryId,
  name,
  icon,
}: {
  locationId: string;
  categoryId: string;
  name: string;
  icon: string | null;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(name);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/lokasyonlar/${locationId}/kategoriler/${categoryId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          icon: String(form.get("icon") ?? ""),
        }),
      },
    );

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Kaydedilemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
    router.refresh();
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

      <Sheet open={open} onClose={() => setOpen(false)} title="Kategori" guardUnsaved>
        <form onSubmit={save}>
          <Field label="Ad">
            <input
              name="name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <EmojiField
            name="icon"
            defaultValue={icon}
            set="category"
            nameValue={draftName}
            label="Simge"
          />
          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
