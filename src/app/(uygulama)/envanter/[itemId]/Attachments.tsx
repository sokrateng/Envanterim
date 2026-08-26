"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { ATTACHMENT_KINDS, ATTACHMENT_KIND_LABELS } from "@/lib/constants";
import { shrinkImage } from "@/lib/image-client";
import { isImage } from "@/lib/upload-rules";
import { useFill } from "./fill-context";

export type AttachmentView = {
  id: string;
  url: string;
  name: string;
  kind: string;
  mimeType: string | null;
};

/** Faturadan çıkarılan bir kalemin forma gidecek hâli. */
type ExtractedLine = {
  name: string;
  brand: string;
  model: string;
  serialNo: string;
  purchaseDate: string;
  warrantyEndDate: string;
  purchasePrice: string;
  sellerName: string;
};

export function Attachments({
  itemId,
  attachments,
  editable,
  extractionEnabled,
}: {
  itemId: string;
  attachments: AttachmentView[];
  editable: boolean;
  extractionEnabled: boolean;
}) {
  const router = useRouter();
  const { setPrefill } = useFill();
  const [reading, setReading] = useState<string | null>(null);
  const [lines, setLines] = useState<ExtractedLine[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("PHOTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    // Küçültme yalnız görselde; PDF olduğu gibi gider (TUZAKLAR #30).
    const prepared = await shrinkImage(file);
    const body = new FormData();
    body.append("file", prepared);
    body.append("kind", kind);

    const response = await fetch(`/api/ekipman/${itemId}/ekler`, {
      method: "POST",
      body,
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Dosya yüklenemedi");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/ekler/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Ek silinemedi");
      return;
    }
    router.refresh();
  }

  async function readInvoice(attachmentId: string) {
    setReading(attachmentId);
    setError(null);

    const response = await fetch(`/api/ekipman/${itemId}/fatura-oku`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    setReading(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Fatura okunamadı");
      return;
    }

    const payload = (await response.json()) as {
      kalemler: ExtractedLine[];
      not: string | null;
    };
    setNote(payload.not);

    if (payload.kalemler.length === 0) {
      setError("Faturada ekipman kalemi bulunamadı");
      return;
    }
    // Tek kalem varsa seçtirmeye gerek yok; forma doğrudan doldur.
    if (payload.kalemler.length === 1) {
      setPrefill(payload.kalemler[0]);
      return;
    }
    setLines(payload.kalemler);
  }

  /** Fatura okunabilen ek: PDF ya da HEIC olmayan görsel. */
  function canRead(attachment: AttachmentView): boolean {
    const type = attachment.mimeType ?? "";
    return type === "application/pdf" || (isImage(type) && type !== "image/heic");
  }

  const photos = attachments.filter((a) => isImage(a.mimeType ?? ""));
  const documents = attachments.filter((a) => !isImage(a.mimeType ?? ""));

  return (
    <section className="mt-6">
      <h2 className="px-8 pb-2 text-footnote uppercase text-muted">
        Fotoğraf ve belgeler
      </h2>

      {photos.length ? (
        <div className="grid grid-cols-3 gap-2 px-4">
          {photos.map((photo) => (
            <figure key={photo.id} className="relative">
              <a href={photo.url} target="_blank" rel="noreferrer">
                {/* Ekler kimlik doğrulamalı uçtan gelebiliyor; next/image
                    yerine düz img: uzak yükleyici yapılandırması gerekmesin. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="aspect-square w-full rounded-card object-cover"
                />
              </a>
              {editable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(photo.id)}
                  aria-label={`${photo.name} sil`}
                  className="absolute right-1 top-1 h-8 w-8 rounded-full bg-black/60 text-white active:opacity-60"
                >
                  ✕
                </button>
              ) : null}
              {editable && extractionEnabled && photo.kind === "INVOICE" && canRead(photo) ? (
                <button
                  type="button"
                  disabled={reading !== null}
                  onClick={() => readInvoice(photo.id)}
                  className="mt-1 w-full text-caption text-blue active:opacity-60 disabled:opacity-50"
                >
                  {reading === photo.id ? "Okunuyor…" : "Faturadan doldur"}
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {documents.length ? (
        <ul className="mx-4 mt-2 divide-y divide-separator overflow-hidden rounded-card bg-surface">
          {documents.map((document) => (
            <li key={document.id} className="flex min-h-touch items-center gap-3 py-2.5 pl-4 pr-4">
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 active:opacity-60"
              >
                <span className="block truncate text-body">{document.name}</span>
                <span className="block text-footnote text-muted">
                  {ATTACHMENT_KIND_LABELS[document.kind] ?? document.kind} · PDF
                </span>
              </a>
              {editable && extractionEnabled && canRead(document) ? (
                <button
                  type="button"
                  disabled={reading !== null}
                  onClick={() => readInvoice(document.id)}
                  className="min-h-touch px-2 text-subheadline text-blue active:opacity-60 disabled:opacity-50"
                >
                  {reading === document.id ? "Okunuyor…" : "Faturadan doldur"}
                </button>
              ) : null}
              {editable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(document.id)}
                  className="min-h-touch px-2 text-subheadline text-red active:opacity-60"
                >
                  Sil
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {attachments.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          Fatura, garanti belgesi, kılavuz ve ürün fotoğrafı buraya eklenir.
        </p>
      ) : null}

      {editable ? (
        <div className="mx-4 mt-3 flex gap-2">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            aria-label="Belge türü"
            className="min-h-touch flex-1 rounded-card border border-separator bg-surface px-3 text-subheadline"
          >
            {ATTACHMENT_KINDS.map((option) => (
              <option key={option} value={option}>
                {ATTACHMENT_KIND_LABELS[option]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="min-h-touch rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Yükleniyor…" : "Dosya seç"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet
        open={lines !== null}
        onClose={() => setLines(null)}
        title="Faturadaki kalemler"
      >
        <p className="pt-2 text-footnote text-muted">
          Faturada birden fazla kalem var. Bu ekipman hangisi? Seçtiğin kalem
          forma doldurulur, kaydetmeden önce kontrol edersin.
        </p>
        {note ? (
          <p className="pt-2 text-footnote text-orange">Model notu: {note}</p>
        ) : null}
        <ul className="mt-3 divide-y divide-separator overflow-hidden rounded-card bg-bg">
          {(lines ?? []).map((line, index) => (
            <li key={`${line.name}-${index}`}>
              <button
                type="button"
                onClick={() => {
                  setPrefill(line);
                  setLines(null);
                }}
                className="flex min-h-touch w-full flex-col items-start px-3 py-2 text-left active:bg-surface-pressed"
              >
                <span className="text-headline">{line.name}</span>
                <span className="text-footnote text-muted">
                  {[line.brand, line.model, line.purchasePrice].filter(Boolean).join(" · ") ||
                    "Ayrıntı okunamadı"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}
