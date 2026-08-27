"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import { SerialScanButton } from "@/components/SerialScanButton";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  DEFAULT_CURRENCY,
  ITEM_STATUS,
  ITEM_STATUS_LABELS,
} from "@/lib/constants";
import { visibleFields, type FieldDef } from "@/lib/custom-fields";
import {
  DEFAULT_WARRANTY_MONTHS,
  suggestedWarrantyEnd,
} from "@/lib/warranty";
import type { VendorOption } from "@/lib/vendors";

export type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  fields: FieldDef[];
};

export type { VendorOption };

export type ItemDefaults = {
  name?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  place?: string;
  purchaseDate?: string;
  warrantyEndDate?: string;
  purchasePrice?: string;
  currency?: string;
  status?: string;
  categoryId?: string;
  sellerId?: string;
  /** Listede olmayan satıcının adı; faturadan da gelebiliyor. */
  sellerName?: string;
  customFields?: Record<string, unknown>;
};

/** Açılır listede "yeni satıcı" seçeneğinin değeri; kimlik değil, kip anahtarı. */
const NEW_SELLER = "__yeni__";

/** Dinamik alan girdilerinin ad öneki; toplarken bu önekle ayrılıyorlar. */
export const CUSTOM_PREFIX = "ozel_";

export function collectCustomFields(form: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith(CUSTOM_PREFIX)) {
      values[key.slice(CUSTOM_PREFIX.length)] = value;
    }
  }
  return values;
}

export function ItemFields({
  categories,
  vendors = [],
  defaults = {},
}: {
  categories: CategoryOption[];
  vendors?: VendorOption[];
  defaults?: ItemDefaults;
}) {
  const [categoryId, setCategoryId] = useState(defaults.categoryId ?? "");
  const selected = categories.find((category) => category.id === categoryId);
  const stored = defaults.customFields ?? {};

  // Seri no barkoddan okunabildiği için denetimli: okunan değer alana yazılıyor.
  const [serialNo, setSerialNo] = useState(defaults.serialNo ?? "");
  const [model, setModel] = useState(defaults.model ?? "");

  /**
   * Garanti bitişi alış tarihinden öneriliyor: kullanıcı alış tarihini
   * seçtiğinde alan 24 ay sonrasıyla doluyor, isterse değiştiriyor.
   *
   * Öneri yalnız **alana dokunulmadıysa** yazılıyor. Kayıtlı bir tarihle açılan
   * düzenleme formu baştan "dokunulmuş" sayılıyor: var olan garanti tarihi
   * gerçek veri, alış tarihini düzelten kullanıcının üstüne yazmamalı. Aynı
   * sebeple öneri yalnız kullanıcının değiştirmesiyle çıkıyor, açılışta değil
   * — yoksa düzenleme formunu açıp kaydetmek, garantisi bilerek boş bırakılan
   * bir ekipmana sessizce tarih koyardı.
   */
  const [warrantyEnd, setWarrantyEnd] = useState(defaults.warrantyEndDate ?? "");
  const [warrantyTouched, setWarrantyTouched] = useState(
    Boolean(defaults.warrantyEndDate),
  );
  /** Alandaki değer bizim önerimiz mi; ipucu buna bakıyor. */
  const [suggested, setSuggested] = useState(false);

  // Satıcı tek alan gibi davranıyor: listeden seç ya da "yeni" deyip adını yaz.
  // Faturadan bir ad geldiyse ya da lokasyonun hiç satıcısı yoksa doğrudan
  // yazma kipinde açılıyor — boş bir açılır listeye bakıp "nereye yazacağım?"
  // dememek için.
  const [newSeller, setNewSeller] = useState(
    Boolean(defaults.sellerName) || vendors.length === 0,
  );

  return (
    <>
      <Field label="Ad">
        <input
          name="name"
          required
          autoFocus
          defaultValue={defaults.name}
          className={inputClass}
          placeholder="Çamaşır makinesi"
        />
      </Field>

      {categories.length ? (
        <Field
          label="Kategori"
          hint="Kategoriye tanımlı özel alanlar aşağıda çıkar."
        >
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClass}
          >
            <option value="">Kategorisiz</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon ? `${category.icon} ` : ""}
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Marka">
          <input name="brand" defaultValue={defaults.brand} className={inputClass} />
        </Field>
        <Field label="Model">
          <input
            name="model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Seri no"
        hint="Cihazın üstündeki barkod ya da QR koddan okutabilirsin."
      >
        <div className="flex items-center gap-2">
          <input
            name="serialNo"
            value={serialNo}
            onChange={(event) => setSerialNo(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            className={inputClass}
          />
          <SerialScanButton
            onRead={(serial, kod) => {
              setSerialNo(serial);
              // Kayıt QR'ı modeli de taşıyor. Kullanıcının yazdığının üstüne
              // yazmıyoruz: okunan model tahmin, elle girilen bilgi değil.
              if (kod) setModel((now) => now.trim() || kod);
            }}
          />
        </div>
      </Field>

      <Field label="Yer" hint="Oda, raf, kat — serbest metin.">
        <input
          name="place"
          defaultValue={defaults.place}
          className={inputClass}
          placeholder="Mutfak"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Alış tarihi">
          <input
            type="date"
            name="purchaseDate"
            defaultValue={defaults.purchaseDate}
            onChange={(event) => {
              if (warrantyTouched) return;
              const oneri = suggestedWarrantyEnd(event.target.value);
              setWarrantyEnd(oneri);
              setSuggested(oneri !== "");
            }}
            className={inputClass}
          />
        </Field>
        <Field
          label="Garanti bitişi"
          hint={
            suggested
              ? `Alıştan ${DEFAULT_WARRANTY_MONTHS} ay sonrası önerildi; değiştirebilirsin.`
              : undefined
          }
        >
          <input
            type="date"
            name="warrantyEndDate"
            value={warrantyEnd}
            onChange={(event) => {
              setWarrantyTouched(true);
              setSuggested(false);
              setWarrantyEnd(event.target.value);
            }}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Satıcı"
        hint={
          newSeller
            ? "Yazdığın ad kaydedilir; sonraki ekipmanlarda listeden seçilir."
            : "Nereden aldın? Listede yoksa yeni satıcı ekle."
        }
      >
        {newSeller ? (
          <div className="flex items-center gap-2">
            <input
              name="sellerName"
              defaultValue={defaults.sellerName}
              autoFocus={vendors.length > 0}
              className={inputClass}
              placeholder="Teknosa"
            />
            {vendors.length ? (
              <button
                type="button"
                onClick={() => setNewSeller(false)}
                className="min-h-touch shrink-0 px-2 text-body text-blue active:opacity-60"
              >
                Listeden
              </button>
            ) : null}
          </div>
        ) : (
          <select
            name="sellerId"
            defaultValue={defaults.sellerId ?? ""}
            onChange={(event) => {
              if (event.target.value === NEW_SELLER) setNewSeller(true);
            }}
            className={inputClass}
          >
            <option value="">Seçilmedi</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
            <option value={NEW_SELLER}>+ Yeni satıcı…</option>
          </select>
        )}
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Alış tutarı" hint="Örn. 18.400,50">
          <input
            name="purchasePrice"
            inputMode="decimal"
            defaultValue={defaults.purchasePrice}
            className={inputClass}
            placeholder="0,00"
          />
        </Field>
        <Field label="Para birimi">
          <select
            name="currency"
            defaultValue={defaults.currency ?? DEFAULT_CURRENCY}
            className={inputClass}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {CURRENCY_LABELS[code] ?? code}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Durum">
        <select
          name="status"
          defaultValue={defaults.status ?? "IN_USE"}
          className={inputClass}
        >
          {ITEM_STATUS.map((status) => (
            <option key={status} value={status}>
              {ITEM_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>

      {selected && visibleFields(selected.fields).length ? (
        <div className="pt-2">
          <p className="pb-1 text-footnote uppercase text-muted">
            {selected.name} alanları
          </p>
          {visibleFields(selected.fields).map((field) => (
            <CustomInput
              key={field.key}
              field={field}
              value={stored[field.key]}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function CustomInput({ field, value }: { field: FieldDef; value: unknown }) {
  const name = `${CUSTOM_PREFIX}${field.key}`;
  const label = field.required ? `${field.label} *` : field.label;
  const text = value === undefined || value === null ? "" : String(value);

  if (field.type === "BOOL") {
    return (
      <label className="flex min-h-touch items-center justify-between gap-3 py-2">
        <span className="text-body">{label}</span>
        <input
          type="checkbox"
          name={name}
          defaultChecked={value === true}
          className="h-6 w-6 accent-[var(--ios-blue)]"
        />
      </label>
    );
  }

  if (field.type === "SELECT") {
    return (
      <Field label={label}>
        <select name={name} defaultValue={text} className={inputClass}>
          <option value="">Seçilmedi</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input
        name={name}
        type={field.type === "DATE" ? "date" : "text"}
        inputMode={field.type === "NUMBER" ? "decimal" : undefined}
        defaultValue={text}
        className={inputClass}
      />
    </Field>
  );
}
