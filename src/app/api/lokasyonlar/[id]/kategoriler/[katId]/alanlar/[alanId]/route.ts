import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { fieldUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string; katId: string; alanId: string }>;
};

/**
 * Alan tanımı silinmez, gizlenir: silmek değeri silmiyor ve sessizce
 * görünmez veri bırakıyor (TUZAKLAR #26). Gizlenen alanın değeri
 * `Item.customFields` içinde korunur, tekrar görünür yapılabilir.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id, katId, alanId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, fieldUpdateSchema);
  if ("response" in parsed) return parsed.response;

  const field = await prisma.categoryField.findFirst({
    where: { id: alanId, categoryId: katId, category: { locationId: id } },
    select: { id: true },
  });
  if (!field) return apiError("Alan bulunamadı", 404);

  const updated = await prisma.categoryField.update({
    where: { id: field.id },
    data: parsed.data,
    select: { id: true, label: true, required: true, hidden: true, order: true },
  });

  return NextResponse.json(updated);
}
