import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { removeFile } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ ekId: string }> },
) {
  const { ekId } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id: ekId },
    select: {
      id: true,
      path: true,
      name: true,
      item: { select: { name: true, locationId: true } },
    },
  });
  if (!attachment) return apiError("Ek bulunamadı", 404);

  const access = await requireLocationEditor(attachment.item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  // Sunucusuz fonksiyon yanıttan sonra iş yapamaz; silme await ediliyor
  // (TUZAKLAR #1).
  await removeFile(attachment.path);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await logAudit({
    locationId: attachment.item.locationId,
    userId: access.userId,
    action: "DELETE",
    entity: "ATTACHMENT",
    entityId: attachment.id,
    summary: `${attachment.item.name}: "${attachment.name}" eki silindi`,
  });

  return NextResponse.json({ silindi: true });
}
