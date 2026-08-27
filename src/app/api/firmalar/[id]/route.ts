import { NextResponse } from "next/server";
import { UNAUTHENTICATED, apiError, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { vendorSchema } from "@/lib/validation";

/** Firma kullanıcının lokasyonlarından birine mi ait? */
async function benimMi(userId: string, vendorId: string) {
  const locationIds = (
    await prisma.locationMember.findMany({
      where: { userId },
      select: { locationId: true },
    })
  ).map((m) => m.locationId);

  return prisma.vendor.findFirst({
    where: { id: vendorId, locationId: { in: locationIds } },
    select: { id: true },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("firma-guncelle", async () => {
    const user = await currentUser();
    if (!user) return UNAUTHENTICATED();

    const { id } = await params;
    if (!(await benimMi(user.id, id))) return apiError("Firma bulunamadı", 404);

    const parsed = await parseBody(request, vendorSchema);
    if ("response" in parsed) return parsed.response;

    await prisma.vendor.update({
      where: { id },
      data: {
        name: parsed.data.name,
        isSeller: parsed.data.isSeller,
        isService: parsed.data.isService,
        phone: parsed.data.phone ?? null,
        note: parsed.data.note ?? null,
      },
    });

    return NextResponse.json({ guncellendi: true });
  });
}

/**
 * Silme yalnız hiç kullanılmamış firma için.
 *
 * Silinen firmanın kimliği ekipmanda ve servis kaydında null'a düşerdi:
 * kullanıcı bir firmayı silerken yirmi ekipmanın satıcısının boşalacağını
 * beklemiyor. Kullanılan firmanın adı düzeltilebiliyor, rolü kapatılabiliyor
 * — ama geçmişi silinmiyor (CLAUDE.md'deki "geçmiş kaybolmasın" kuralının
 * aynısı).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("firma-sil", async () => {
    const user = await currentUser();
    if (!user) return UNAUTHENTICATED();

    const { id } = await params;
    if (!(await benimMi(user.id, id))) return apiError("Firma bulunamadı", 404);

    const [items, jobs, parts, events] = await prisma.$transaction([
      prisma.item.count({ where: { sellerId: id } }),
      prisma.serviceJob.count({ where: { vendorId: id } }),
      prisma.part.count({ where: { vendorId: id } }),
      prisma.itemEvent.count({ where: { vendorId: id } }),
    ]);

    const kullanim = items + jobs + parts + events;
    if (kullanim > 0) {
      return apiError(
        `Bu firma ${kullanim} kayıtta kullanılıyor; silinemez. Adını düzeltebilir ya da rolünü kapatabilirsin.`,
        409,
      );
    }

    await prisma.vendor.delete({ where: { id } });
    return NextResponse.json({ silindi: true });
  });
}
