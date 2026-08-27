import { NextResponse } from "next/server";
import { getLocationAccess } from "@/lib/access";
import { NOT_MEMBER, apiError, guard } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * Kişisel favori işareti.
 *
 * Puan gibi üyeliğe bağlı, düzenleme yetkisine değil: ekipmanı kullanan kişi
 * çoğu zaman düzenleyen değil, ama kendi kısa listesini o tutuyor. Kayıt
 * kişiye ait olduğu için gövde yok — kim olduğu oturumdan geliyor.
 */

/** Ekipman var mı ve bu kullanıcı lokasyonun üyesi mi. */
type Uyelik =
  | { hata: NextResponse; itemId?: undefined; userId?: undefined }
  | { hata?: undefined; itemId: string; userId: string };

async function uyelik(itemId: string): Promise<Uyelik> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, locationId: true },
  });
  if (!item) return { hata: apiError("Ekipman bulunamadı", 404) };

  const access = await getLocationAccess(item.locationId);
  if (!access) return { hata: NOT_MEMBER() };

  return { itemId: item.id, userId: access.userId };
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("favori", async () => {
    const { id } = await params;
    const sonuc = await uyelik(id);
    if (sonuc.hata) return sonuc.hata;

    // Aynı işareti iki kez koymak hata değil; upsert sessizce aynı yere düşer.
    await prisma.itemFavorite.upsert({
      where: {
        itemId_userId: { itemId: sonuc.itemId, userId: sonuc.userId },
      },
      create: { itemId: sonuc.itemId, userId: sonuc.userId },
      update: {},
    });

    return NextResponse.json({ favori: true });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("favori-sil", async () => {
    const { id } = await params;
    const sonuc = await uyelik(id);
    if (sonuc.hata) return sonuc.hata;

    await prisma.itemFavorite.deleteMany({
      where: { itemId: sonuc.itemId, userId: sonuc.userId },
    });

    return NextResponse.json({ favori: false });
  });
}
