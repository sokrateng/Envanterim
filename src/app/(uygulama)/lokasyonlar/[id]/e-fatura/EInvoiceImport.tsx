"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { priceToMinor } from "@/lib/invoice";

type Line = {
  sira: number;
  ad: string;
  marka: string | null;
  model: string | null;
  birimFiyat: number | null;
  adet: number;
};

type Preview = {
  xml: string;
  satici: string | null;
  tarih: string | null;
  faturaNo: string | null;
  paraBirimi: string | null;
  kalemler: Line[];
};

/**
 * e-Fatura XML'inden ekipman oluşturma. Ayrıştırma kesin ama faturada kargo,
 * hizmet, sarf da olabiliyor: hangi kalemin ekipman olduğuna kullanıcı karar
 * veriyor.
 */
export function EInvoiceImport({ locationId }: { locationId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setDone(null);

    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`/api/lokasyonlar/${locationId}/e-fatura`, {
      method: "POST",
      body,
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Fatura okunamadı");
      return;
    }

    const payload = (await response.json()) as Preview;
    setPreview(payload);
    // Varsayılan olarak hepsi seçili: çoğu faturada tüm kalemler ekipman.
    setSelected(new Set(payload.kalemler.map((line) => line.sira)));
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/lokasyonlar/${locationId}/e-fatura`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ xml: preview.xml, secilen: [...selected] }),
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Ekipman oluşturulamadı");
      return;
    }

    const payload = await response.json();
    setPreview(null);
    setSelected(new Set());
    setDone(`${payload.eklenen} ekipman eklendi`);
    router.refresh();
  }

  function toggle(sira: number) {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(sira)) next.delete(sira);
      else next.add(sira);
      return next;
    });
  }

  const currency = preview?.paraBirimi ?? "TRY";
  const toplamAdet = preview
    ? preview.kalemler
        .filter((line) => selected.has(line.sira))
        .reduce((total, line) => total + line.adet, 0)
    : 0;

  return (
    <section className="mt-6">
      <div className="mx-4 rounded-card bg-surface p-4">
        <p className="text-footnote text-muted">
          e-Arşiv ya da e-Fatura XML dosyasını yükle. Veri faturanın kendisinden
          okunuyor — model kullanılmıyor, tahmin yok.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="mt-3 min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
        >
          {busy && !preview ? "Okunuyor…" : "XML seç"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xml,text/xml,application/xml"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />

        {done ? (
          <p className="pt-2 text-footnote text-green" role="status">
            {done}
          </p>
        ) : null}
        {error ? (
          <p className="pt-2 text-footnote text-red" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="mx-4 mt-3 rounded-card bg-surface p-4">
          <p className="text-headline">{preview.satici ?? "Satıcı okunamadı"}</p>
          <p className="text-footnote text-muted">
            {[preview.faturaNo, preview.tarih].filter(Boolean).join(" · ") ||
              "Fatura bilgisi eksik"}
          </p>

          <ul className="mt-3 divide-y divide-separator">
            {preview.kalemler.map((line) => {
              const minor = priceToMinor(line.birimFiyat);
              return (
                <li key={line.sira}>
                  <label className="flex min-h-touch items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(line.sira)}
                      onChange={() => toggle(line.sira)}
                      className="h-6 w-6 shrink-0 accent-[var(--ios-blue)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body">{line.ad}</span>
                      <span className="block truncate text-footnote text-muted">
                        {[line.marka, line.model].filter(Boolean).join(" ") || "Marka yok"}
                        {line.adet > 1 ? ` · ${line.adet} adet` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-subheadline text-muted">
                      {minor === null ? "—" : formatMoney(minor, currency)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={confirm}
            className="mt-3 min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Ekleniyor…" : `${toplamAdet} ekipman oluştur`}
          </button>
          <p className="pt-2 text-footnote text-muted">
            Seri no faturada yok; ekipman sayfasından eklersin. Garanti bitişi
            fatura tarihinden 24 ay sonrası varsayılıyor — farklıysa ekipman
            sayfasından düzeltebilirsin.
          </p>
        </div>
      ) : null}
    </section>
  );
}
