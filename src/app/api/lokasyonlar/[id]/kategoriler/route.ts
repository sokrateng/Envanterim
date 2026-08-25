import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { categorySchema } from "@/lib/validation";

// Kategori tanımlamak lokasyon sahibinin işi (MIMARI §2 rol tablosu).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, categorySchema);
  if ("response" in parsed) return parsed.response;

  const existing = await prisma.category.findFirst({
    where: { locationId: id, name: parsed.data.name },
    select: { id: true },
  });
  if (existing) return apiError("Bu adla bir kategori zaten var", 409);

  const category = await prisma.category.create({
    data: { locationId: id, name: parsed.data.name, icon: parsed.data.icon },
    select: { id: true, name: true, icon: true },
  });

  return NextResponse.json(category, { status: 201 });
}
