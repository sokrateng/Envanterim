import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

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
    select: {
      id: true,
      kind: true,
      date: true,
      item: { select: { id: true, name: true, locationId: true } },
    },
  });
  if (!event) return apiError("Kayıt bulunamadı", 404);

  const access = await requireLocationEditor(event.item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  await prisma.itemEvent.delete({ where: { id: event.id } });
  await logAudit({
    locationId: event.item.locationId,
    userId: access.userId,
    action: "DELETE",
    entity: "EVENT",
    entityId: event.id,
    summary: `${event.item.name}: ${event.date.toLocaleDateString("tr-TR")} tarihli kayıt silindi`,
  });

  return NextResponse.json({ silindi: true });
}
