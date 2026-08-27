import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";
import { notifyItemChange } from "@/lib/item-notify";
import { itemStatusSchema } from "@/lib/validation";

// Ekipman silinmez; yaşam döngüsünden durumla çıkar (CLAUDE.md).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, locationId: true },
  });
  // Üye olmayan için "yok" ile "yetkisiz" aynı yanıt: envanterin varlığı sızmaz.
  if (!item) return apiError("Ekipman bulunamadı", 404);

  const access = await requireLocationEditor(item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, itemStatusSchema);
  if ("response" in parsed) return parsed.response;

  const updated = await prisma.item.update({
    where: { id: item.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });

  if (item.status !== updated.status) {
    const degisiklik =
      `Durum: ${ITEM_STATUS_LABELS[item.status as ItemStatus]} → ` +
      `${ITEM_STATUS_LABELS[updated.status as ItemStatus]}`;

    const editor = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { name: true },
    });
    // Yanıttan sonra iş yapılmıyor (TUZAKLAR #1).
    await notifyItemChange(
      item,
      item.locationId,
      access.userId,
      editor?.name ?? "Bir üye",
      [degisiklik],
    );

    await logAudit({
      locationId: item.locationId,
      userId: access.userId,
      action: "UPDATE",
      entity: "ITEM",
      entityId: item.id,
      summary: `${item.name}: ${degisiklik.toLocaleLowerCase("tr")}`,
    });
  }

  return NextResponse.json(updated);
}
