import { prisma } from "@/lib/prisma";
import {
  buildCustomFieldsSchema,
  mergeCustomFields,
  type FieldDef,
} from "@/lib/custom-fields";
import { firstError } from "@/lib/validation";
import type { FieldType } from "@/lib/constants";

/**
 * Kategoriye bağlı dinamik alanları yükleyip gelen değerleri doğrular.
 * Uçlar bu tek yerden geçer; doğrulamayı atlayan bir yol kalmasın.
 */
export async function loadFieldDefs(
  categoryId: string | null | undefined,
  locationId: string,
): Promise<FieldDef[]> {
  if (!categoryId) return [];

  // Kategori başka bir lokasyonunki olabilir: lokasyon eşleşmesi burada.
  const category = await prisma.category.findFirst({
    where: { id: categoryId, locationId },
    select: {
      fields: {
        select: {
          key: true,
          label: true,
          type: true,
          required: true,
          options: true,
          hidden: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!category) return [];

  return category.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type as FieldType,
    required: field.required,
    options: Array.isArray(field.options) ? (field.options as string[]) : null,
    hidden: field.hidden,
  }));
}

export type CustomFieldsResult =
  | { ok: true; values: Record<string, string | number | boolean> }
  | { ok: false; message: string };

export function validateCustomFields(
  raw: Record<string, unknown>,
  fields: FieldDef[],
  existing: unknown,
): CustomFieldsResult {
  const parsed = buildCustomFieldsSchema(fields).safeParse(raw);
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  return { ok: true, values: mergeCustomFields(existing, parsed.data, fields) };
}
