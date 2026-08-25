import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { categorySchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string; katId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, katId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, categorySchema);
  if ("response" in parsed) return parsed.response;

  const category = await prisma.category.findFirst({
    where: { id: katId, locationId: id },
    select: { id: true },
  });
  if (!category) return apiError("Kategori bulunamadı", 404);

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: { name: parsed.data.name, icon: parsed.data.icon ?? null },
    select: { id: true, name: true, icon: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, katId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const category = await prisma.category.findFirst({
    where: { id: katId, locationId: id },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!category) return apiError("Kategori bulunamadı", 404);

  // Kategorisi silinen ekipmanın dinamik alan değerleri öksüz kalırdı
  // (TUZAKLAR #26); ekipman varken silmeye izin verilmiyor.
  if (category._count.items > 0) {
    return apiError(
      `Bu kategoride ${category._count.items} ekipman var; önce başka kategoriye taşı`,
      409,
    );
  }

  await prisma.category.delete({ where: { id: category.id } });
  return NextResponse.json({ silindi: true });
}
