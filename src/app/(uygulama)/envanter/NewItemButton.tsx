"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { InvoiceLines } from "@/components/InvoiceLines";
import {
  ItemFields,
  collectCustomFields,
  type CategoryOption,
  type ItemDefaults,
  type VendorOption,
} from "@/components/ItemFields";
import { shrinkImage } from "@/lib/image-client";
import type { InvoiceFormValues } from "@/lib/invoice";

export function NewItemButton({
  locations,
  defaultLocationId,
  categoriesByLocation,
  vendorsByLocation,
  extractionEnabled,
  autoOpen = false,
  presetSerial = "",
  trigger = true,
}: {
  locations: Array<{ id: string; name: string }>;
  defaultLocationId: string;
  categoriesByLocation: Record<string, CategoryOption[]>;
  vendorsByLocation: Record<string, VendorOption[]>;
  extractionEnabled: boolean;
  /** Adreste `yeni=1` varsa panel kendiliğinden açılıyor (sekme çubuğu, tarama). */
  autoOpen?: boolean;
  /** Taranan barkod: yeni ekipmanın seri no alanına düşüyor. */
  presetSerial?: string;
  /**
   * Kendi düğmesini çizsin mi. Envanter listesinde çizmiyor: aynı işi sekme
   * çubuğundaki düğme yapıyor, iki giriş kapısı gereksiz.
   */
  trigger?: boolean;
}) {
  const closeAndRefresh = useCloseAndRefresh();
  const params = useSearchParams();
  const [open, setOpen] = useState(autoOpen);

  /**
   * Sekme çubuğundaki düğme adrese `yeni=1` koyuyor. Envanter listesindeyken
   * bileşen yeniden kurulmadığı için başlangıç durumu bunu görmüyor; efekt
   * görüyor.
   *
   * İşaret açılışta **hemen** siliniyor: adreste kalsaydı aynı düğmeye ikinci
   * kez dokunmak adresi değiştirmez, dolayısıyla hiçbir şey olmazdı (panel
   * geri tuşuyla kapatıldıktan sonra tam olarak bu oluyordu). Silme
   * `history.replaceState` ile, çünkü eşzamanlı: panelin kendi geçmiş kaydını
   * itmesinden önce bitiyor. `router.replace` asenkron, sonra düşüp panelin
   * kaydını eziyordu (TUZAKLAR #60'ın komşusu).
   */
  const yeniIstegi = params.get("yeni");
  useEffect(() => {
    if (yeniIstegi !== "1") return;

    const kalan = new URLSearchParams(window.location.search);
    kalan.delete("yeni");
    kalan.delete("seri");
    const sorgu = kalan.toString();
    window.history.replaceState(
      window.history.state,
      "",
      sorgu ? `${window.location.pathname}?${sorgu}` : window.location.pathname,
    );

    reset();
    setOpen(true);
    // reset her render'da yeniden kuruluyor; efektin bağımlılığı olsaydı
    // panel açıkken gelen her çizimde formu sıfırlardı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yeniIstegi]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(defaultLocationId);

  // Faturadan doldurma. Dosya kaydedilene kadar elde tutuluyor: ekipman
  // açılınca aynı dosya ek olarak yükleniyor, kullanıcı iki kez seçmesin.
  const fileInput = useRef<HTMLInputElement>(null);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [lines, setLines] = useState<InvoiceFormValues[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<ItemDefaults>(
    presetSerial ? { serialNo: presetSerial } : {},
  );
  const [savedWarning, setSavedWarning] = useState<string | null>(null);
  // Alanlar `defaultValue` ile kurulu; doldurulan değerin görünmesi için
  // yeniden kurulmaları gerekiyor (lokasyon değişiminde olduğu gibi).
  const [fillCount, setFillCount] = useState(0);

  function reset() {
    setError(null);
    setInvoice(null);
    setLines(null);
    setNote(null);
    setDefaults(presetSerial ? { serialNo: presetSerial } : {});
    setFillCount(0);
    setReading(false);
    setSavedWarning(null);
  }

  async function readInvoice(picked: File) {
    setReading(true);
    setError(null);
    setNote(null);

    // Küçültme yalnız görselde; PDF olduğu gibi gider (TUZAKLAR #30).
    const prepared = await shrinkImage(picked);
    setInvoice(prepared);

    const body = new FormData();
    body.append("file", prepared);

    const response = await fetch(`/api/lokasyonlar/${locationId}/fatura-oku`, {
      method: "POST",
      body,
    });
    setReading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Fatura okunamadı");
      return;
    }

    const payload = (await response.json()) as {
      kalemler: InvoiceFormValues[];
      not: string | null;
    };
    setNote(payload.not);

    if (payload.kalemler.length === 0) {
      setError("Faturada ekipman kalemi bulunamadı");
      return;
    }
    // Tek kalem varsa seçtirmeye gerek yok; forma doğrudan doldur.
    if (payload.kalemler.length === 1) {
      fill(payload.kalemler[0]);
      return;
    }
    setLines(payload.kalemler);
  }

  function fill(line: InvoiceFormValues) {
    setDefaults(line);
    setFillCount((count) => count + 1);
    setLines(null);
  }

  /** Fatura, ekipman açıldıktan sonra ek olarak yükleniyor: kimlik o an var. */
  async function attachInvoice(itemId: string): Promise<boolean> {
    if (!invoice) return true;

    const body = new FormData();
    body.append("file", invoice);
    // Faturanın fotoğrafı da faturadır; tür dosya biçimine göre değişmiyor.
    body.append("kind", "INVOICE");

    const response = await fetch(`/api/ekipman/${itemId}/ekler`, {
      method: "POST",
      body,
    });
    return response.ok;
  }

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
        currency: text("currency") || "TRY",
        warrantyEndDate: text("warrantyEndDate"),
        status: text("status") || "IN_USE",
        customFields: collectCustomFields(form),
      }),
    });

    if (!response.ok) {
      setPending(false);
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Ekipman eklenemedi");
      return;
    }

    const created = (await response.json()) as { id: string };
    const attached = await attachInvoice(created.id);
    setPending(false);

    // Ekipman açıldı; ek yüklenemediyse iş yarıda kalmadı ama kullanıcı bunu
    // bilmeli. Formu yeniden göndermek ekipmanı ikizlerdi, o yüzden form
    // yerine kapanış mesajı gösteriliyor.
    if (!attached) {
      setSavedWarning(
        "Ekipman eklendi ama fatura ek olarak yüklenemedi. Ekipman sayfasından ekleyebilirsin.",
      );
      return;
    }

    reset();
    closeAndRefresh(() => setOpen(false));
  }

  return (
    <>
      {trigger ? (
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="min-h-touch px-2 text-body text-blue active:opacity-60"
          aria-label="Ekipman ekle"
        >
          + Yeni
        </button>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni ekipman" guardUnsaved>
        {savedWarning ? (
          <div className="pb-2">
            <p role="alert" className="py-2 text-body text-orange">
              {savedWarning}
            </p>
            <button
              type="button"
              onClick={() => {
                reset();
                closeAndRefresh(() => setOpen(false));
              }}
              className="mt-3 min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95"
            >
              Tamam
            </button>
          </div>
        ) : (
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

          {extractionEnabled ? (
            <div className="rounded-card bg-bg p-3">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  // Aynı dosya ikinci kez seçilebilsin diye değer sıfırlanıyor.
                  event.target.value = "";
                  if (picked) void readInvoice(picked);
                }}
              />
              <button
                type="button"
                disabled={reading}
                onClick={() => fileInput.current?.click()}
                className="min-h-touch w-full rounded-card bg-surface px-3 text-headline text-blue transition active:scale-95 disabled:opacity-50"
              >
                {reading ? "Fatura okunuyor…" : "Faturadan doldur"}
              </button>
              <p className="pt-2 text-caption text-muted">
                Elindeki faturayı (PDF ya da fotoğraf) seç; alanları doldurur.
                Kaydedince fatura ekipmana belge olarak da eklenir.
              </p>
              {fillCount > 0 ? (
                <p className="pt-1 text-caption text-blue">
                  Alanlar faturadan dolduruldu — kaydetmeden önce kontrol et.
                </p>
              ) : null}
              {note ? (
                <p className="pt-1 text-caption text-orange">Model notu: {note}</p>
              ) : null}
            </div>
          ) : null}

          {/* Lokasyon değişince kategori seçimi sıfırlansın: kategoriler
              lokasyona ait, önceki seçim başka lokasyonunki olurdu. */}
          <ItemFields
            key={`${locationId}-${fillCount}`}
            categories={categoriesByLocation[locationId] ?? []}
            vendors={vendorsByLocation[locationId] ?? []}
            defaults={defaults}
          />

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
        )}
      </Sheet>

      <InvoiceLines
        lines={lines}
        note={note}
        onPick={fill}
        onClose={() => setLines(null)}
      />
    </>
  );
}
