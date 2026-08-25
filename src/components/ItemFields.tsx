"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import { ITEM_STATUS, ITEM_STATUS_LABELS } from "@/lib/constants";
import { visibleFields, type FieldDef } from "@/lib/custom-fields";

export type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  fields: FieldDef[];
};

export type ItemDefaults = {
  name?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  place?: string;
  purchaseDate?: string;
  warrantyEndDate?: string;
  purchasePrice?: string;
  status?: string;
  categoryId?: string;
  customFields?: Record<string, unknown>;
};

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
  defaults = {},
}: {
  categories: CategoryOption[];
  defaults?: ItemDefaults;
}) {
  const [categoryId, setCategoryId] = useState(defaults.categoryId ?? "");
  const selected = categories.find((category) => category.id === categoryId);
  const stored = defaults.customFields ?? {};

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
          <input name="model" defaultValue={defaults.model} className={inputClass} />
        </Field>
      </div>

      <Field label="Seri no">
        <input
          name="serialNo"
          defaultValue={defaults.serialNo}
          autoCapitalize="characters"
          className={inputClass}
        />
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
            className={inputClass}
          />
        </Field>
        <Field label="Garanti bitişi">
          <input
            type="date"
            name="warrantyEndDate"
            defaultValue={defaults.warrantyEndDate}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Alış tutarı" hint="Örn. 18.400,50">
        <input
          name="purchasePrice"
          inputMode="decimal"
          defaultValue={defaults.purchasePrice}
          className={inputClass}
          placeholder="0,00"
        />
      </Field>

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
