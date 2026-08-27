import { NextResponse } from "next/server";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveVendor } from "@/lib/seller";
import { statusAfterService } from "@/lib/service";
import { currentUser } from "@/lib/session";
import { serviceCreateSchema } from "@/lib/validation";

/**
 * Ekipmanı yetkili servise gönderme.
 *
 * Kayıt açılınca ekipmanın durumu da "Serviste" oluyor: durumu ayrıca elle
 * değiştirmek gerekseydi ikisi kaçınılmaz olarak birbirinden ayrı düşerdi.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("servis-ekle", async () => {
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        locationId: true,
        status: true,
        serviceJobs: { select: { returnedAt: true } },
      },
    });
    if (!item) return apiError("Ekipman bulunamadı", 404);

    const access = await requireLocationEditor(item.locationId);
    if (!access) return NOT_MEMBER();
    if (access === "readonly") return READONLY();

    const parsed = await parseBody(request, serviceCreateSchema);
    if ("response" in parsed) return parsed.response;
    const data = parsed.data;

    const vendor = await resolveVendor(
      item.locationId,
      data.vendorId,
      data.vendorName,
      "service",
    );
    if (!vendor.ok) return apiError(vendor.message, 422);

    const user = await currentUser();
    const sentAt = data.sentAt ?? new Date();

    const [job] = await prisma.$transaction([
      prisma.serviceJob.create({
        data: {
          itemId: item.id,
          vendorId: vendor.vendorId,
          complaint: data.complaint,
          sentAt,
          trackingNo: data.trackingNo ?? null,
          createdById: user?.id ?? null,
        },
        select: { id: true },
      }),
      prisma.item.update({
        where: { id: item.id },
        data: {
          status: statusAfterService(item.status, [
            ...item.serviceJobs,
            { returnedAt: null },
          ]),
        },
      }),
    ]);

    return NextResponse.json(job, { status: 201 });
  });
}
