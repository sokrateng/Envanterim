"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = {
  onaylanacak: number;
  hatali: Array<{ line: number; errors: string[] }>;
  ornek: Array<{ ad: string; marka: string | null; durum: string }>;
};

/**
 * CSV dışa/içe aktarma. İçe aktarma iki adımlı: önce önizleme, sonra onay.
 * Dışarıdan gelen veri kullanıcı görmeden kaydedilmiyor — faturadan okumadaki
 * kuralın aynısı.
 */
export function CsvTools({
  locationId,
  itemCount,
  canImport,
  columns,
}: {
  locationId: string;
  itemCount: number;
  canImport: boolean;
  columns: string[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(confirm: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    if (confirm) body.append("onayla", "evet");

    const response = await fetch(`/api/lokasyonlar/${locationId}/csv`, {
      method: "POST",
      body,
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Dosya işlenemedi");
      return;
    }

    const payload = await response.json();
    if (confirm) {
      setPreview(null);
      setFile(null);
      setDone(`${payload.eklenen} ekipman eklendi`);
      router.refresh();
      return;
    }
    setPreview(payload as Preview);
  }

  return (
    <>
      <section className="mt-6">
        <h2 className="px-8 pb-2 text-footnote uppercase text-muted">Dışa aktar</h2>
        <div className="mx-4 rounded-card bg-surface p-4">
          <p className="text-footnote text-muted">
            {itemCount} ekipman, sahip olma maliyetiyle birlikte. Excel'de
            açılacak biçimde (noktalı virgül ayracı, Türkçe karakterler bozulmaz).
          </p>
          <a
            href={`/api/lokasyonlar/${locationId}/csv`}
            className="mt-3 flex min-h-touch items-center justify-center rounded-card bg-blue px-4 text-headline text-white transition active:scale-95"
          >
            CSV indir
          </a>
        </div>
      </section>

      {canImport ? (
        <section className="mt-6">
          <h2 className="px-8 pb-2 text-footnote uppercase text-muted">İçe aktar</h2>
          <div className="mx-4 rounded-card bg-surface p-4">
            <p className="text-footnote text-muted">
              Sütunlar: {columns.join(", ")}. Yalnız <strong>Ad</strong> zorunlu;
              kategori ve satıcı adları eşleşmezse açılır.
            </p>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 min-h-touch w-full rounded-card border border-separator px-4 text-body active:bg-surface-pressed"
            >
              {file ? file.name : "Dosya seç"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                event.target.value = "";
                setFile(selected);
                setPreview(null);
                setDone(null);
                setError(null);
              }}
            />

            {file && !preview ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => send(false)}
                className="mt-2 min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
              >
                {busy ? "Okunuyor…" : "Önizle"}
              </button>
            ) : null}

            {preview ? (
              <div className="mt-3 rounded-card bg-bg p-3">
                <p className="text-body">
                  {preview.onaylanacak} satır eklenmeye hazır
                  {preview.hatali.length
                    ? `, ${preview.hatali.length} satır atlanacak`
                    : ""}
                  .
                </p>
                {preview.ornek.length ? (
                  <ul className="pt-2">
                    {preview.ornek.map((row, index) => (
                      <li key={`${row.ad}-${index}`} className="text-footnote text-muted">
                        · {row.ad}
                        {row.marka ? ` — ${row.marka}` : ""}
                      </li>
                    ))}
                    {preview.onaylanacak > preview.ornek.length ? (
                      <li className="text-footnote text-muted">…</li>
                    ) : null}
                  </ul>
                ) : null}

                {preview.hatali.length ? (
                  <ul className="pt-2">
                    {preview.hatali.slice(0, 5).map((row) => (
                      <li key={row.line} className="text-footnote text-orange">
                        {row.line}. satır: {row.errors.join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  disabled={busy || preview.onaylanacak === 0}
                  onClick={() => send(true)}
                  className="mt-3 min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
                >
                  {busy ? "Ekleniyor…" : `${preview.onaylanacak} ekipmanı ekle`}
                </button>
              </div>
            ) : null}

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
        </section>
      ) : null}
    </>
  );
}
