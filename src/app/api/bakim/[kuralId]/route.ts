import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ kuralId: string }> },
) {
  const { kuralId } = await params;

  const rule = await prisma.maintenanceRule.findUnique({
    where: { id: kuralId },
    select: { id: true, item: { select: { locationId: true } } },
  });
  if (!rule) return apiError("Bakım kuralı bulunamadı", 404);

  const access = await requireLocationEditor(rule.item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  await prisma.maintenanceRule.delete({ where: { id: rule.id } });
  return NextResponse.json({ silindi: true });
}
