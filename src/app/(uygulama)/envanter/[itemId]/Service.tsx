"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { Fold } from "@/components/ui";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { phoneHref, websiteHref, websiteLabel } from "@/lib/vendor-contact";

/**
 * Yetkili servis kayıtları: arızadan sonuca.
 *
 * Ekipmanın durumu bu kayıtlarla birlikte değişiyor — kayıt açılınca
 * "Serviste", sonuç girilince "Kullanımda". Durumu ayrıca elle değiştirmek
 * gerekseydi ikisi kaçınılmaz olarak birbirinden ayrı düşerdi.
 */

export type ServiceRow = {
  id: string;
  vendorName: string | null;
  vendorPhone: string | null;
  vendorWebsite: string | null;
  complaint: string;
  sentAt: string;
  trackingNo: string | null;
  /** Servisin takip sayfası; numarayla birlikte veriliyor. */
  trackingUrl: string | null;
  returnedAt: string | null;
  work: string | null;
  /** Biçimlendirilmiş tutar; garanti kapsamındaysa null. */
  cost: string | null;
  durum: string;
  odeme: string | null;
  open: boolean;
  /** Düzenleme formunun okuduğu ham değerler. */
  form: {
    complaint: string;
    vendorId: string;
    sentAt: string;
    trackingNo: string;
    trackingUrl: string;
    returnedAt: string;
    work: string;
    cost: string;
    paid: boolean;
    underWarranty: boolean;
  };
};

export function Service({
  itemId,
  jobs,
  vendors,
  editable,
}: {
  itemId: string;
  jobs: ServiceRow[];
  vendors: Array<{ id: string; name: string }>;
  editable: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();

  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [editVendor, setEditVendor] = useState(false);
  const [editReturned, setEditReturned] = useState("");
  const [editWarranty, setEditWarranty] = useState(false);
  const [closing, setClosing] = useState<ServiceRow | null>(null);
  const [removing, setRemoving] = useState<ServiceRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVendor, setNewVendor] = useState(vendors.length === 0);
  const [underWarranty, setUnderWarranty] = useState(false);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/ekipman/${itemId}/servis`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        complaint: text("complaint"),
        sentAt: text("sentAt"),
        vendorId: text("vendorId"),
        vendorName: text("vendorName"),
        trackingNo: text("trackingNo"),
        trackingUrl: text("trackingUrl"),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Servis kaydı açılamadı");
      return;
    }
    closeAndRefresh(() => setSending(false));
  }

  async function close(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closing) return;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/servis/${closing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        returnedAt: text("returnedAt"),
        work: text("work"),
        cost: text("cost"),
        paid: form.get("paid") === "on",
        underWarranty: form.get("underWarranty") === "on",
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Sonuç kaydedilemedi");
      return;
    }
    closeAndRefresh(() => setClosing(null));
  }

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/servis/${editing.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        complaint: text("complaint"),
        sentAt: text("sentAt"),
        vendorId: text("vendorId"),
        vendorName: text("vendorName"),
        trackingNo: text("trackingNo"),
        trackingUrl: text("trackingUrl"),
        returnedAt: editReturned,
        work: text("work"),
        cost: text("cost"),
        paid: form.get("paid") === "on",
        underWarranty: editWarranty,
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Kayıt güncellenemedi");
      return;
    }
    closeAndRefresh(() => setEditing(null));
  }

  function startEdit(job: ServiceRow) {
    setError(null);
    setEditVendor(vendors.length === 0);
    setEditReturned(job.form.returnedAt);
    setEditWarranty(job.form.underWarranty);
    setEditing(job);
  }

  async function remove(job: ServiceRow) {
    setRemoving(null);
    const response = await fetch(`/api/servis/${job.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Kayıt silinemedi");
      return;
    }
    router.refresh();
  }

  return (
    <Fold title="Servis" count={jobs.length}>
      {jobs.length === 0 ? (
        <p className="text-footnote text-muted">
          Arızalanan ekipmanı servise gönderdiğinde buraya yaz: nerede, kaç
          gündür, ne yapıldı, ücret ödendi mi. Kayıt açılınca ekipman
          &quot;Serviste&quot; oluyor.
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-card bg-bg p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-headline">
                  {job.vendorName ?? "Servis belirtilmedi"}
                </span>
                <span
                  className={`shrink-0 text-footnote ${
                    job.open ? "text-orange" : "text-muted"
                  }`}
                >
                  {job.durum}
                </span>
              </div>

              <p className="pt-1 text-body">{job.complaint}</p>
              {/* Servisteki ekipmanın sahibinin ilk işi aramak: numarayı
                  firmalar ekranında aratmak yerine kaydın yanında duruyor. */}
              {phoneHref(job.vendorPhone) || websiteHref(job.vendorWebsite) ? (
                <div className="flex flex-wrap items-center gap-x-4 pt-1">
                  {phoneHref(job.vendorPhone) ? (
                    <a
                      href={phoneHref(job.vendorPhone) ?? undefined}
                      aria-label={`${job.vendorName ?? "Servis"} ara`}
                      className="min-h-touch whitespace-nowrap text-footnote text-blue active:opacity-60"
                    >
                      {job.vendorPhone}
                    </a>
                  ) : null}
                  {websiteHref(job.vendorWebsite) ? (
                    <a
                      href={websiteHref(job.vendorWebsite) ?? undefined}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="min-h-touch truncate text-footnote text-blue active:opacity-60"
                    >
                      {websiteLabel(job.vendorWebsite)}
                    </a>
                  ) : null}
                </div>
              ) : null}

              <p className="pt-1 text-footnote text-muted">
                {job.sentAt} tarihinde gönderildi
                {job.trackingNo && !websiteHref(job.trackingUrl)
                  ? ` · fiş ${job.trackingNo}`
                  : ""}
                {job.returnedAt ? ` · ${job.returnedAt} döndü` : ""}
              </p>

              {/* Takip adresi varsa fiş numarası bağlantının kendisi oluyor:
                  kullanıcı numarayı kopyalayıp sitede aratmak yerine
                  doğrudan gidiyor. */}
              {websiteHref(job.trackingUrl) ? (
                <a
                  href={websiteHref(job.trackingUrl) ?? undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-touch items-center text-footnote text-blue active:opacity-60"
                >
                  {job.trackingNo ? `Fiş ${job.trackingNo} · takip et` : "Takip et"}
                </a>
              ) : null}

              {job.work ? (
                <p className="whitespace-pre-wrap pt-2 text-body">{job.work}</p>
              ) : null}

              {job.cost || job.odeme ? (
                <p className="pt-1 text-footnote text-muted">
                  {[job.cost, job.odeme].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              {editable ? (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => startEdit(job)}
                    className="min-h-touch text-footnote text-blue active:opacity-60"
                  >
                    Düzenle
                  </button>
                  {job.open ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setUnderWarranty(false);
                        setClosing(job);
                      }}
                      className="min-h-touch text-footnote text-blue active:opacity-60"
                    >
                      Sonucu gir
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setRemoving(job)}
                    className="min-h-touch text-footnote text-red active:opacity-60"
                  >
                    Sil
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNewVendor(vendors.length === 0);
            setSending(true);
          }}
          className="min-h-touch pt-2 text-body text-blue active:opacity-60"
        >
          + Servise gönder
        </button>
      ) : null}

      {error && !sending && !closing && !editing ? (
        <p role="alert" className="pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet
        open={sending}
        onClose={() => setSending(false)}
        title="Servise gönder"
        guardUnsaved
      >
        <form onSubmit={send} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Arıza" hint="Servise ne anlattın?">
            <textarea
              name="complaint"
              rows={3}
              required
              autoFocus
              placeholder="Su almıyor, tamburdan ses geliyor"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field
            label="Yetkili servis"
            hint={
              newVendor
                ? "Yazdığın ad kaydedilir; sonraki gönderimde listeden seçilir."
                : "Listede yoksa yeni servis ekle."
            }
          >
            {newVendor ? (
              <div className="flex items-center gap-2">
                <input
                  name="vendorName"
                  className={inputClass}
                  placeholder="Bosch Yetkili Servisi"
                />
                {vendors.length ? (
                  <button
                    type="button"
                    onClick={() => setNewVendor(false)}
                    className="min-h-touch shrink-0 px-2 text-body text-blue active:opacity-60"
                  >
                    Listeden
                  </button>
                ) : null}
              </div>
            ) : (
              <select
                name="vendorId"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value === "__yeni__") setNewVendor(true);
                }}
                className={inputClass}
              >
                <option value="">Seçilmedi</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
                <option value="__yeni__">+ Yeni servis…</option>
              </select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gönderim tarihi">
              <input type="date" name="sentAt" className={inputClass} />
            </Field>
            <Field label="Fiş / takip no">
              <input name="trackingNo" className={inputClass} />
            </Field>
          </div>

          <Field
            label="Takip adresi"
            hint="Servisin durum sayfası varsa; kayıttan tek dokunuşla açılır."
          >
            {/* type="url" değil: tarayıcı şemasız adresi reddedip formu
                sessizce göndermiyor (TUZAKLAR #74). */}
            <input
              name="trackingUrl"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="servis.example.com/takip"
              className={inputClass}
            />
          </Field>

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Servis kaydını düzenle"
        guardUnsaved
      >
        {editing ? (
          <form onSubmit={update} className="max-h-[70dvh] overflow-y-auto pb-2">
            <Field label="Arıza">
              <textarea
                name="complaint"
                rows={3}
                required
                defaultValue={editing.form.complaint}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <Field
              label="Yetkili servis"
              hint={
                editVendor
                  ? "Yazdığın ad kaydedilir."
                  : "Listede yoksa yeni servis ekle."
              }
            >
              {editVendor ? (
                <div className="flex items-center gap-2">
                  <input name="vendorName" className={inputClass} />
                  {vendors.length ? (
                    <button
                      type="button"
                      onClick={() => setEditVendor(false)}
                      className="min-h-touch shrink-0 px-2 text-body text-blue active:opacity-60"
                    >
                      Listeden
                    </button>
                  ) : null}
                </div>
              ) : (
                <select
                  name="vendorId"
                  defaultValue={editing.form.vendorId}
                  onChange={(event) => {
                    if (event.target.value === "__yeni__") setEditVendor(true);
                  }}
                  className={inputClass}
                >
                  <option value="">Seçilmedi</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                  <option value="__yeni__">+ Yeni servis…</option>
                </select>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Gönderim tarihi">
                <input
                  type="date"
                  name="sentAt"
                  defaultValue={editing.form.sentAt}
                  className={inputClass}
                />
              </Field>
              <Field label="Fiş / takip no">
                <input
                  name="trackingNo"
                  defaultValue={editing.form.trackingNo}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Takip adresi">
              <input
                name="trackingUrl"
                type="text"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                defaultValue={editing.form.trackingUrl}
                placeholder="servis.example.com/takip"
                className={inputClass}
              />
            </Field>

            {/* Dönüş tarihi boşaltılınca kayıt yeniden açılıyor: yanlışlıkla
                kapatılan işi düzeltmenin yolu kaydı silmek olmamalı. */}
            <Field
              label="Dönüş tarihi"
              hint={
                editReturned
                  ? "Boşaltırsan kayıt yeniden açılır, ekipman Serviste olur."
                  : "Kayıt açık. Tarih girersen sonuç alanları çıkar."
              }
            >
              <input
                type="date"
                name="returnedAt"
                value={editReturned}
                onChange={(event) => setEditReturned(event.target.value)}
                className={inputClass}
              />
            </Field>

            {editReturned ? (
              <>
                <Field label="Yapılan iş">
                  <textarea
                    name="work"
                    rows={3}
                    defaultValue={editing.form.work}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <label className="flex min-h-touch items-center justify-between gap-3 py-2">
                  <span className="text-body">Garanti kapsamında</span>
                  <input
                    type="checkbox"
                    checked={editWarranty}
                    onChange={(event) => setEditWarranty(event.target.checked)}
                    className="h-6 w-6 accent-[var(--ios-blue)]"
                  />
                </label>

                {editWarranty ? null : (
                  <>
                    <Field label="Ücret" hint="Örn. 1.250,00">
                      <input
                        name="cost"
                        inputMode="decimal"
                        defaultValue={editing.form.cost}
                        className={inputClass}
                      />
                    </Field>
                    <label className="flex min-h-touch items-center justify-between gap-3 py-2">
                      <span className="text-body">Ödendi</span>
                      <input
                        type="checkbox"
                        name="paid"
                        defaultChecked={editing.form.paid}
                        className="h-6 w-6 accent-[var(--ios-blue)]"
                      />
                    </label>
                  </>
                )}
              </>
            ) : null}

            <FormError message={error} />
            <SubmitButton pending={pending}>Kaydet</SubmitButton>
          </form>
        ) : null}
      </Sheet>

      <Sheet
        open={closing !== null}
        onClose={() => setClosing(null)}
        title="Servis sonucu"
        guardUnsaved
      >
        <form onSubmit={close} className="max-h-[70dvh] overflow-y-auto pb-2">
          <Field label="Yapılan iş">
            <textarea
              name="work"
              rows={3}
              autoFocus
              placeholder="Pompa değişti, filtre temizlendi"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Dönüş tarihi" hint="Boş bırakırsan bugün.">
            <input type="date" name="returnedAt" className={inputClass} />
          </Field>

          <label className="flex min-h-touch items-center justify-between gap-3 py-2">
            <span className="text-body">Garanti kapsamında</span>
            <input
              type="checkbox"
              name="underWarranty"
              checked={underWarranty}
              onChange={(event) => setUnderWarranty(event.target.checked)}
              className="h-6 w-6 accent-[var(--ios-blue)]"
            />
          </label>

          {/* Garanti kapsamındaki işte ücret sorulmuyor: "ödenmedi" demek
              yanlış bir borç izlenimi bırakırdı. */}
          {underWarranty ? (
            <p className="pb-2 text-footnote text-muted">
              Garanti kapsamındaki iş sahip olma maliyetine girmiyor.
            </p>
          ) : (
            <>
              <Field label="Ücret" hint="Örn. 1.250,00">
                <input
                  name="cost"
                  inputMode="decimal"
                  placeholder="0,00"
                  className={inputClass}
                />
              </Field>
              <label className="flex min-h-touch items-center justify-between gap-3 py-2">
                <span className="text-body">Ödendi</span>
                <input
                  type="checkbox"
                  name="paid"
                  className="h-6 w-6 accent-[var(--ios-blue)]"
                />
              </label>
            </>
          )}

          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        title="Servis kaydı silinsin mi?"
        message="Bu geri alınamaz. Ekipmanın durumu kalan kayıtlara göre düzelir."
        confirmLabel="Sil"
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </Fold>
  );
}
