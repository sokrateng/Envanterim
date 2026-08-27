import { NextResponse } from "next/server";
import { z } from "zod";
import { getLocationAccess } from "@/lib/access";
import { NOT_MEMBER, apiError, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { MAX_STARS, MIN_STARS } from "@/lib/rating";

const bodySchema = z.object({
  yildiz: z.coerce
    .number()
    .int("Puan tam sayı olmalı")
    .min(MIN_STARS, "Puan 1 ile 5 arasında olmalı")
    .max(MAX_STARS, "Puan 1 ile 5 arasında olmalı"),
});

/**
 * Kullanıcının bu ekipmana verdiği puan. Kişi başına tek puan; tekrar
 * gönderilince öncekinin üstüne yazıyor.
 *
 * Puan vermek için üye olmak yeter: ekipmanı kullanan kişi çoğu zaman
 * düzenleyen değil, beğeniyi de o biliyor.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("puan", async () => {
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, locationId: true },
    });
    if (!item) return apiError("Ekipman bulunamadı", 404);

    const access = await getLocationAccess(item.locationId);
    if (!access) return NOT_MEMBER();

    const parsed = await parseBody(request, bodySchema);
    if ("response" in parsed) return parsed.response;

    await prisma.itemRating.upsert({
      where: { itemId_userId: { itemId: item.id, userId: access.userId } },
      create: { itemId: item.id, userId: access.userId, stars: parsed.data.yildiz },
      update: { stars: parsed.data.yildiz },
    });

    return NextResponse.json({ yildiz: parsed.data.yildiz });
  });
}

/** Puanı geri alma: fikrini değiştiren kullanıcı sıfırlayabilmeli. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("puan-sil", async () => {
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, locationId: true },
    });
    if (!item) return apiError("Ekipman bulunamadı", 404);

    const access = await getLocationAccess(item.locationId);
    if (!access) return NOT_MEMBER();

    await prisma.itemRating.deleteMany({
      where: { itemId: item.id, userId: access.userId },
    });

    return NextResponse.json({ silindi: true });
  });
}
