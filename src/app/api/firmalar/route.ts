import { NextResponse } from "next/server";
import { UNAUTHENTICATED, apiError, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { vendorSchema } from "@/lib/validation";

/**
 * Firma açma.
 *
 * Firma lokasyondan bağımsız seçiliyor ama kayıt yine bir lokasyona çapalı:
 * bu uygulamada yetki lokasyon üyeliğinden geçiyor (CLAUDE.md), sahipsiz bir
 * kaydı kimin görebileceğini söyleyecek bir kural kalmazdı. Çapa, kullanıcının
 * düzenleyebildiği ilk lokasyon.
 */
export async function POST(request: Request) {
  return guard("firma", async () => {
    const user = await currentUser();
    if (!user) return UNAUTHENTICATED();

    const parsed = await parseBody(request, vendorSchema);
    if ("response" in parsed) return parsed.response;

    const membership = await prisma.locationMember.findFirst({
      where: { userId: user.id, role: { in: ["OWNER", "EDITOR"] } },
      select: { locationId: true },
      orderBy: { locationId: "asc" },
    });
    if (!membership) {
      return apiError("Önce bir lokasyon aç: firmalar oraya bağlanıyor", 422);
    }

    const locationIds = (
      await prisma.locationMember.findMany({
        where: { userId: user.id },
        select: { locationId: true },
      })
    ).map((m) => m.locationId);

    // Aynı ad iki kez açılmasın: kullanıcı zaten var olan firmayı yazdıysa
    // rolü ekleyip o kaydı veriyoruz.
    const existing = await prisma.vendor.findFirst({
      where: {
        locationId: { in: locationIds },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { id: true, isSeller: true, isService: true },
    });

    if (existing) {
      const updated = await prisma.vendor.update({
        where: { id: existing.id },
        data: {
          isSeller: existing.isSeller || parsed.data.isSeller,
          isService: existing.isService || parsed.data.isService,
          phone: parsed.data.phone ?? undefined,
          note: parsed.data.note ?? undefined,
        },
        select: { id: true },
      });
      return NextResponse.json({ id: updated.id, birlestirildi: true });
    }

    const vendor = await prisma.vendor.create({
      data: {
        locationId: membership.locationId,
        name: parsed.data.name,
        isSeller: parsed.data.isSeller,
        isService: parsed.data.isService,
        phone: parsed.data.phone ?? null,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: vendor.id }, { status: 201 });
  });
}
