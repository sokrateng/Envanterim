import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ parcaId: string }> },
) {
  const { parcaId } = await params;

  const part = await prisma.part.findUnique({
    where: { id: parcaId },
    select: { id: true, item: { select: { locationId: true } } },
  });
  if (!part) return apiError("Parça bulunamadı", 404);

  const access = await requireLocationEditor(part.item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  await prisma.part.delete({ where: { id: part.id } });
  return NextResponse.json({ silindi: true });
}
