"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Badge, Fold } from "@/components/ui";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { EVENT_KINDS, type EventKind } from "@/lib/constants";
import { EVENT_KIND_LABELS, eventSummary, type TimelineEvent } from "@/lib/events";
import { SwipeRow, UndoBar } from "@/components/SwipeRow";
import { useCloseAndRefresh } from "@/lib/history-layer";

/** Sunucudan gelen hâli: tarihler JSON'da metin. */
export type TimelineRow = Omit<TimelineEvent, "date"> & { date: string };

/** Geri alma şeridinin ekranda kalma süresi. */
const UNDO_MS = 5000;

const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const KIND_TONE: Record<EventKind, "blue" | "orange" | "green" | "muted"> = {
  SERVICE: "orange",
  READING: "blue",
  LOG: "muted",
  ASSIGNMENT: "green",
};

export function Timeline({
  itemId,
  events,
  vendors,
  members,
  currency,
  editable,
}: {
  itemId: string;
  events: TimelineRow[];
  vendors: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  currency: string;
  editable: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EventKind>("SERVICE");
  const [filter, setFilter] = useState<EventKind | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Silinmek üzere olan satır listede durmuyor; geri alınırsa geri geliyor.
  const shown = (filter ? events.filter((event) => event.kind === filter) : events)
    .filter((event) => event.id !== deleting);

  async function create(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(formEvent.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const body: Record<string, unknown> = {
      kind,
      date: text("date"),
      note: text("note"),
    };
    if (kind === "SERVICE") {
      body.vendorId = text("vendorId");
      body.vendorName = text("vendorName");
      body.cost = text("cost");
    }
    if (kind === "READING") {
      body.readingValue = text("readingValue");
      body.readingUnit = text("readingUnit");
    }
    if (kind === "ASSIGNMENT") {
      body.assignedToUserId = text("assignedToUserId");
      body.assignedPlace = text("assignedPlace");
    }

    const response = await fetch(`/api/ekipman/${itemId}/olaylar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Kayıt eklenemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  /**
   * Silme hemen yapılmıyor: satır listeden kalkıyor, geri alma şeridi çıkıyor
   * ve süre dolunca istek gidiyor. Dokunmatikte kazara silmek çok kolay;
   * sayfadan çıkılırsa istek hiç gitmiyor — yanlış yön kayıp değil.
   */
  function askRemove(eventId: string) {
    setError(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setDeleting(eventId);

    undoTimer.current = setTimeout(() => {
      setDeleting(null);
      void remove(eventId);
    }, UNDO_MS);
  }

  function undoRemove() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setDeleting(null);
  }

  async function remove(eventId: string) {
    const response = await fetch(`/api/olaylar/${eventId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Kayıt silinemedi");
      return;
    }
    router.refresh();
  }

  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <Fold title="Zaman çizelgesi" count={events.length}>

      {events.length ? (
        <div
          role="tablist"
          aria-label="Kayıt türü filtresi"
          className="mb-2 flex gap-1 overflow-x-auto rounded-card bg-separator/40 p-1"
        >
          {[null, ...EVENT_KINDS].map((option) => {
            const active = option === filter;
            return (
              <button
                key={option ?? "hepsi"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(option)}
                className={`min-h-[36px] flex-1 basis-0 min-w-fit whitespace-nowrap rounded-[8px] px-2.5 text-footnote transition active:scale-95 ${
                  active ? "bg-surface text-ink shadow-sm" : "text-muted"
                }`}
              >
                {option ? EVENT_KIND_LABELS[option] : "Tümü"}
              </button>
            );
          })}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="text-footnote text-muted">
          {events.length
            ? "Bu türde kayıt yok."
            : "Servis, sayaç okuması, olay günlüğü ve zimmet kayıtları burada birikir."}
        </p>
      ) : (
        <ul className="divide-y divide-separator overflow-hidden rounded-card bg-bg">
          {shown.map((row) => {
            const event: TimelineEvent = { ...row, date: new Date(row.date) };
            const summary = eventSummary(event, currency);
            const body = (
              <div className="flex min-h-touch items-start gap-3 py-2.5 pl-4 pr-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-headline">{trDate.format(event.date)}</span>
                    <Badge tone={KIND_TONE[event.kind]}>
                      {EVENT_KIND_LABELS[event.kind]}
                    </Badge>
                  </div>
                  {summary ? (
                    <div className="text-footnote text-muted">{summary}</div>
                  ) : null}
                </div>
                {/* Kaydırma kısayol; tek yol değil (docs/TASARIM.md). */}
                {editable ? (
                  <button
                    type="button"
                    onClick={() => askRemove(row.id)}
                    className="min-h-touch px-2 text-subheadline text-red active:opacity-60"
                  >
                    Sil
                  </button>
                ) : null}
              </div>
            );

            return (
              <li key={row.id}>
                {editable ? (
                  <SwipeRow
                    label={`${trDate.format(event.date)} ${EVENT_KIND_LABELS[event.kind]}`}
                    actions={[
                      { label: "Sil", tone: "red", onSelect: () => askRemove(row.id) },
                    ]}
                  >
                    {body}
                  </SwipeRow>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}

      {deleting ? (
        <UndoBar message="Kayıt silindi" onUndo={undoRemove} />
      ) : null}

      {error ? (
        <p role="alert" className="pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      {editable ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-touch pt-2 text-body text-blue active:opacity-60"
        >
          + Kayıt
        </button>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni kayıt" guardUnsaved>
        <form onSubmit={create} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Tür">
            <select
              value={kind}
              onChange={(changeEvent) => setKind(changeEvent.target.value as EventKind)}
              className={inputClass}
            >
              {EVENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {EVENT_KIND_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tarih">
            <input
              type="date"
              name="date"
              required
              defaultValue={todayValue}
              className={inputClass}
            />
          </Field>

          {kind === "SERVICE" ? (
            <>
              <Field label="Servis veren" hint="Listede yoksa aşağıya adını yaz.">
                <select name="vendorId" defaultValue="" className={inputClass}>
                  <option value="">Seçilmedi</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Yeni servis">
                <input name="vendorName" className={inputClass} placeholder="Bosch Yetkili Servis" />
              </Field>
              <Field label="Tutar" hint="Örn. 1.850,00">
                <input name="cost" inputMode="decimal" className={inputClass} placeholder="0,00" />
              </Field>
            </>
          ) : null}

          {kind === "READING" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sayaç değeri">
                <input
                  name="readingValue"
                  inputMode="decimal"
                  required
                  className={inputClass}
                  placeholder="128500"
                />
              </Field>
              <Field label="Birim">
                <input name="readingUnit" className={inputClass} placeholder="km" />
              </Field>
            </div>
          ) : null}

          {kind === "ASSIGNMENT" ? (
            <>
              <Field label="Kime" hint="Yalnız lokasyon üyeleri.">
                <select name="assignedToUserId" defaultValue="" className={inputClass}>
                  <option value="">Seçilmedi</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nerede">
                <input name="assignedPlace" className={inputClass} placeholder="Şantiye" />
              </Field>
            </>
          ) : null}

          <Field label="Not">
            <input
              name="note"
              className={inputClass}
              placeholder={kind === "SERVICE" ? "Yapılan iş" : "Kısa açıklama"}
            />
          </Field>

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </Fold>
  );
}
