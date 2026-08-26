import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";

/**
 * Bağlantı silinmiyor, iptal ediliyor: kimin ne zaman ne paylaştığı izi
 * kalsın. İptal edilen bağlantı anında geçersiz.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ paylasimId: string }> },
) {
  const { paylasimId } = await params;

  const link = await prisma.shareLink.findUnique({
    where: { id: paylasimId },
    select: { id: true, revokedAt: true, item: { select: { locationId: true } } },
  });
  if (!link) return apiError("Bağlantı bulunamadı", 404);

  const access = await requireLocationEditor(link.item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  if (!link.revokedAt) {
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
    });
  }

  return NextResponse.json({ iptal: true });
}
