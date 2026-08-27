"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageViewer } from "@/components/ImageViewer";
import { Sheet } from "@/components/Sheet";
import { FormError, SubmitButton, inputClass } from "@/components/form";
import { shrinkImage } from "@/lib/image-client";
import { NOTE_PHOTO_LIMIT } from "@/lib/notes";
import { useCloseAndRefresh } from "@/lib/history-layer";

/**
 * Ekipman notları: tarif, ayar, uyarı — fotoğraflı.
 *
 * Zaman çizelgesi olan biteni tutuyor, notlar bilgiyi. Yazan ve tarih görünür
 * duruyor: paylaşılan bir envanterde "bunu kim yazmış" gerçek bir soru.
 */

export type NoteView = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  /** Yazan bensem düzenleyebiliyorum; sahipsem silebiliyorum (sunucu da bakar). */
  canEdit: boolean;
  canDelete: boolean;
  photos: Array<{ id: string; url: string; name: string }>;
};

export function Notes({
  itemId,
  notes,
  canWrite,
}: {
  itemId: string;
  notes: NoteView[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NoteView | null>(null);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<NoteView | null>(null);

  function startNew() {
    setEditing(null);
    setBody("");
    setPhotos([]);
    setError(null);
    setOpen(true);
  }

  function startEdit(note: NoteView) {
    setEditing(note);
    setBody(note.body);
    setPhotos([]);
    setError(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);

    let response: Response;
    if (editing) {
      response = await fetch(`/api/notlar/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
    } else {
      const form = new FormData();
      form.append("body", body);
      // Küçültme yalnız görselde; not fotoğrafı da telefon çıktısı olabiliyor.
      for (const photo of photos) form.append("file", await shrinkImage(photo));
      response = await fetch(`/api/ekipman/${itemId}/notlar`, {
        method: "POST",
        body: form,
      });
    }

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Not kaydedilemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  async function remove(note: NoteView) {
    setRemoving(null);
    const response = await fetch(`/api/notlar/${note.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Not silinemedi");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-8 pb-2">
        <h2 className="text-footnote uppercase text-muted">Notlar</h2>
        {canWrite ? (
          <button
            type="button"
            onClick={startNew}
            className="min-h-touch px-2 text-body text-blue active:opacity-60"
          >
            + Not
          </button>
        ) : null}
      </div>

      {notes.length === 0 ? (
        <p className="px-8 text-footnote text-muted">
          Tarif, doğru ayar, servise söylenecekler… Kullanan kişinin bildiği her
          şey buraya. Fotoğraf da eklenebiliyor.
        </p>
      ) : (
        <ul className="mx-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-card bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-subheadline">{note.authorName}</span>
                <span className="shrink-0 text-caption text-muted">
                  {note.createdAt}
                </span>
              </div>
              <p className="whitespace-pre-wrap pt-1 text-body">{note.body}</p>

              {note.photos.length ? (
                <div className="flex gap-2 overflow-x-auto pt-2">
                  {note.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setViewing(photo)}
                      aria-label={`${photo.name} büyüt`}
                      className="shrink-0 active:opacity-80"
                    >
                      {/* Ekler kimlik doğrulamalı uçtan gelebiliyor; düz img. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.name}
                        loading="lazy"
                        className="h-20 w-20 rounded-card bg-bg object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              {note.canEdit || note.canDelete ? (
                <div className="flex gap-3 pt-2">
                  {note.canEdit ? (
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="min-h-touch text-footnote text-blue active:opacity-60"
                    >
                      Düzenle
                    </button>
                  ) : null}
                  {note.canDelete ? (
                    <button
                      type="button"
                      onClick={() => setRemoving(note)}
                      className="min-h-touch text-footnote text-red active:opacity-60"
                    >
                      Sil
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error && !open ? (
        <p role="alert" className="px-8 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Notu düzenle" : "Yeni not"}
        guardUnsaved
      >
        <form onSubmit={save} className="max-h-[70dvh] overflow-y-auto pb-2">
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            required
            autoFocus
            placeholder="Örnek: 500 ml süt, 100 g şeker, 20 dakika. Kabı önce dondurucuda beklet."
            className={`${inputClass} resize-none`}
          />

          {editing ? (
            <p className="pt-2 text-footnote text-muted">
              Fotoğraflar not açılırken ekleniyor; değiştirmek için notu silip
              yeniden yazman gerekiyor.
            </p>
          ) : (
            <div className="pt-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const picked = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  setPhotos((now) =>
                    [...now, ...picked].slice(0, NOTE_PHOTO_LIMIT),
                  );
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="min-h-touch w-full rounded-card bg-bg px-3 text-headline text-blue transition active:scale-95"
              >
                Fotoğraf ekle
              </button>
              {photos.length ? (
                <p className="pt-1 text-footnote text-muted">
                  {photos.length} fotoğraf seçildi (en çok {NOTE_PHOTO_LIMIT}).{" "}
                  <button
                    type="button"
                    onClick={() => setPhotos([])}
                    className="text-blue underline"
                  >
                    Temizle
                  </button>
                </p>
              ) : null}
            </div>
          )}

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>

      <ImageViewer
        open={viewing !== null}
        url={viewing?.url ?? ""}
        name={viewing?.name ?? ""}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Not silinsin mi?"
        message="Notun fotoğrafları da silinir. Bu geri alınamaz."
        confirmLabel="Sil"
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
