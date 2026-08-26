import { NextResponse } from "next/server";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { locationCreateSchema } from "@/lib/validation";

/** Adı ve ikonu düzeltmek sahibin işi: yanlış yazılan lokasyon adı kalmasın. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, locationCreateSchema);
  if ("response" in parsed) return parsed.response;

  const onceki = await prisma.location.findUnique({
    where: { id },
    select: { name: true },
  });

  const location = await prisma.location.update({
    where: { id },
    data: { name: parsed.data.name, icon: parsed.data.icon ?? null },
    select: { id: true, name: true, icon: true },
  });

  if (onceki && onceki.name !== location.name) {
    await logAudit({
      locationId: id,
      userId: access.userId,
      action: "UPDATE",
      entity: "LOCATION",
      entityId: id,
      summary: `Lokasyon adı "${onceki.name}" → "${location.name}"`,
    });
  }

  return NextResponse.json(location);
}

/**
 * Lokasyon silme. **Yalnız boşken.**
 *
 * Şemada `onDelete: Cascade` var: dolu bir lokasyonu silmek ekipmanları,
 * servis geçmişini ve maliyet kayıtlarını da götürürdü. Ekipman silinmiyor,
 * yaşam döngüsüyle çıkıyor (CLAUDE.md); dolayısıyla dolu lokasyon da
 * kapanmıyor. Silme yalnız "yanlışlıkla açtım" durumu için.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const itemCount = await prisma.item.count({ where: { locationId: id } });
  if (itemCount > 0) {
    return apiError(
      `Lokasyonda ${itemCount} ekipman var; silinirse geçmişleriyle birlikte ` +
        `kaybolurlar. Ekipman silinmiyor, bu yüzden dolu lokasyon da kapanmıyor.`,
      409,
    );
  }

  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ silindi: true });
}
