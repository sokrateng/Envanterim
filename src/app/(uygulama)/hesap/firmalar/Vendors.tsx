"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { Group, Rows } from "@/components/ui";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { websiteLabel } from "@/lib/vendor-contact";

/**
 * Firma yönetimi: satıcılar ve yetkili servisler.
 *
 * İki liste ayrı gösteriliyor çünkü iki ayrı iş: aldığın yerle tamir ettiğin
 * yer çoğu zaman aynı değil. Bir firma ikisini birden yapıyorsa iki listede
 * de görünüyor — kaydı ikizlemeye gerek yok.
 */

export type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  note: string | null;
  isSeller: boolean;
  isService: boolean;
  /** Kaç kayıtta geçiyor; sıfırsa silinebiliyor. */
  usage: number;
};

const BOS: Omit<VendorRow, "id" | "usage"> = {
  name: "",
  phone: null,
  email: null,
  website: null,
  address: null,
  note: null,
  isSeller: true,
  isService: false,
};

export function Vendors({ vendors }: { vendors: VendorRow[] }) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();

  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [open, setOpen] = useState(false);
  const [isSeller, setIsSeller] = useState(true);
  const [isService, setIsService] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<VendorRow | null>(null);

  const sellers = vendors.filter((v) => v.isSeller);
  const services = vendors.filter((v) => v.isService);

  function start(vendor: VendorRow | null, role: "seller" | "service") {
    setEditing(vendor);
    setIsSeller(vendor ? vendor.isSeller : role === "seller");
    setIsService(vendor ? vendor.isService : role === "service");
    setError(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      website: String(form.get("website") ?? ""),
      address: String(form.get("address") ?? ""),
      note: String(form.get("note") ?? ""),
      isSeller,
      isService,
    });

    const response = await fetch(
      editing ? `/api/firmalar/${editing.id}` : "/api/firmalar",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body,
      },
    );

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Firma kaydedilemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  async function remove(vendor: VendorRow) {
    setRemoving(null);
    const response = await fetch(`/api/firmalar/${vendor.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Firma silinemedi");
      return;
    }
    router.refresh();
  }

  const alan = editing ?? BOS;

  return (
    <>
      <VendorGroup
        title="Satıcılar"
        empty="Ekipmanı nereden aldığın. Ekipman eklerken adını yazdığında da kendiliğinden buraya düşüyor."
        rows={sellers}
        onAdd={() => start(null, "seller")}
        onEdit={(vendor) => start(vendor, "seller")}
      />

      <VendorGroup
        title="Yetkili servisler"
        empty="Arızalanan ekipmanı gönderdiğin yer. Servis kaydı açarken adını yazdığında da buraya düşüyor."
        rows={services}
        onAdd={() => start(null, "service")}
        onEdit={(vendor) => start(vendor, "service")}
      />

      {error && !open ? (
        <p role="alert" className="px-8 pt-3 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <p className="px-8 pt-4 text-footnote text-muted">
        Firmalar lokasyondan bağımsız: bir kez tanımlanıyor, bütün
        lokasyonlarında listeden seçiliyor.
      </p>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Firmayı düzenle" : "Yeni firma"}
        guardUnsaved
      >
        <form onSubmit={save} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Ad">
            <input
              name="name"
              defaultValue={alan.name}
              required
              autoFocus
              placeholder="Bosch Yetkili Servisi"
              className={inputClass}
            />
          </Field>

          <div className="pb-2">
            <RoleToggle
              label="Satıcı"
              hint="Ekipmanı bu firmadan aldın."
              on={isSeller}
              onChange={setIsSeller}
            />
            <RoleToggle
              label="Yetkili servis"
              hint="Arızalanan ekipmanı buraya gönderiyorsun."
              on={isService}
              onChange={setIsService}
            />
          </div>

          <Field label="Telefon" hint="Servis kaydında aramak için düğme olur.">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={alan.phone ?? ""}
              placeholder="0850 000 00 00"
              className={inputClass}
            />
          </Field>

          <Field label="Web sitesi" hint="Randevu ve servis takibi çoğu zaman burada.">
            {/* type="url" değil: tarayıcı şemasız adresi reddedip formu
                sessizce göndermiyor, oysa kullanıcı "bosch.com.tr" yazıyor.
                Şemayı biz tamamlıyoruz (src/lib/vendor-contact.ts). */}
            <input
              name="website"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              defaultValue={alan.website ?? ""}
              placeholder="bosch.com.tr"
              className={inputClass}
            />
          </Field>

          <Field label="E-posta">
            <input
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              defaultValue={alan.email ?? ""}
              placeholder="servis@firma.com"
              className={inputClass}
            />
          </Field>

          <Field label="Adres">
            <textarea
              name="address"
              rows={2}
              defaultValue={alan.address ?? ""}
              placeholder="Kadıköy, İstanbul"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Not">
            <textarea
              name="note"
              rows={2}
              defaultValue={alan.note ?? ""}
              placeholder="Kadıköy şubesi, cumartesi kapalı"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>

          {editing ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setRemoving(editing);
              }}
              className="min-h-touch w-full pt-3 text-body text-red active:opacity-60"
            >
              {editing.usage > 0
                ? `Silinemez: ${editing.usage} kayıtta kullanılıyor`
                : "Firmayı sil"}
            </button>
          ) : null}
        </form>
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        title="Firma silinsin mi?"
        message={
          removing && removing.usage > 0
            ? `${removing.name} ${removing.usage} kayıtta kullanılıyor; silinemez.`
            : "Bu geri alınamaz."
        }
        confirmLabel="Sil"
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

/** Satırın altındaki tek satırlık iletişim özeti. */
function ozet(vendor: VendorRow): string {
  return [vendor.phone, websiteLabel(vendor.website), vendor.note]
    .filter(Boolean)
    .join(" · ");
}

function VendorGroup({
  title,
  empty,
  rows,
  onAdd,
  onEdit,
}: {
  title: string;
  empty: string;
  rows: VendorRow[];
  onAdd: () => void;
  onEdit: (vendor: VendorRow) => void;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="min-h-touch px-2 text-body text-blue active:opacity-60"
        >
          + Firma
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-8 text-footnote text-muted">{empty}</p>
      ) : (
        <Group>
          <Rows>
            {rows.map((vendor) => (
              <button
                key={vendor.id}
                type="button"
                onClick={() => onEdit(vendor)}
                className="flex min-h-touch w-full items-center gap-3 py-2.5 pl-4 pr-4 text-left active:bg-surface-pressed"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">
                    {vendor.name}
                  </span>
                  {ozet(vendor) ? (
                    <span className="block truncate text-footnote text-muted">
                      {ozet(vendor)}
                    </span>
                  ) : null}
                </span>
                {vendor.isSeller && vendor.isService ? (
                  <span className="shrink-0 text-caption text-muted">
                    ikisi de
                  </span>
                ) : null}
                <span aria-hidden className="shrink-0 text-muted">
                  ›
                </span>
              </button>
            ))}
          </Rows>
        </Group>
      )}
    </section>
  );
}

function RoleToggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-touch items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-body">{label}</span>
        <span className="block text-footnote text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 shrink-0 accent-[var(--ios-blue)]"
      />
    </label>
  );
}
