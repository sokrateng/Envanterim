import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { keyFromLabel } from "@/lib/custom-fields";
import { fieldCreateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string; katId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id, katId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, fieldCreateSchema);
  if ("response" in parsed) return parsed.response;
  const { label, type, required, options } = parsed.data;

  if (type === "SELECT" && options.length === 0) {
    return apiError("Seçim alanı için en az bir seçenek gerekli", 422);
  }

  const category = await prisma.category.findFirst({
    where: { id: katId, locationId: id },
    select: { id: true, fields: { select: { key: true, order: true } } },
  });
  if (!category) return apiError("Kategori bulunamadı", 404);

  // Anahtar etiketten üretilir; JSONB'de değerin adresi bu ve sonradan
  // değişmemeli — etiket düzenlenince anahtar sabit kalır.
  const base = keyFromLabel(label) || "alan";
  const used = new Set(category.fields.map((field) => field.key));
  let key = base;
  for (let index = 2; used.has(key); index += 1) key = `${base}_${index}`;

  const order = category.fields.reduce((max, f) => Math.max(max, f.order), -1) + 1;

  const field = await prisma.categoryField.create({
    data: {
      categoryId: category.id,
      key,
      label,
      type,
      required,
      order,
      options: type === "SELECT" ? options : undefined,
    },
    select: { id: true, key: true, label: true, type: true, required: true },
  });

  return NextResponse.json(field, { status: 201 });
}
