import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { itemStatusSchema } from "@/lib/validation";

// Ekipman silinmez; yaşam döngüsünden durumla çıkar (CLAUDE.md).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, locationId: true },
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

  return NextResponse.json(updated);
}
