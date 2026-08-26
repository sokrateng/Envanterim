import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";

/**
 * Olay kaydı silinebilir — ekipmanın kendisi silinmiyor ama yanlış girilmiş
 * bir servis kaydı düzeltilebilmeli.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ olayId: string }> },
) {
  const { olayId } = await params;

  const event = await prisma.itemEvent.findUnique({
    where: { id: olayId },
    select: { id: true, item: { select: { locationId: true } } },
  });
  if (!event) return apiError("Kayıt bulunamadı", 404);

  const access = await requireLocationEditor(event.item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  await prisma.itemEvent.delete({ where: { id: event.id } });
  return NextResponse.json({ silindi: true });
}
