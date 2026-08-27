import { NextResponse } from "next/server";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { statusAfterService } from "@/lib/service";
import { serviceCloseSchema } from "@/lib/validation";

/**
 * Servisin sonucu: dönüş tarihi, yapılan iş, ücret ve ödeme.
 *
 * Sonuç girilince ekipman kullanıma dönüyor — açık başka bir servis işi yoksa.
 * Pasif ya da satılmış ekipman kullanıma dönmüyor (statusAfterService).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ servisId: string }> },
) {
  return guard("servis-sonuc", async () => {
    const { servisId } = await params;

    const job = await prisma.serviceJob.findUnique({
      where: { id: servisId },
      select: {
        id: true,
        itemId: true,
        sentAt: true,
        item: {
          select: {
            locationId: true,
            status: true,
            serviceJobs: { select: { id: true, returnedAt: true } },
          },
        },
      },
    });
    if (!job) return apiError("Servis kaydı bulunamadı", 404);

    const access = await requireLocationEditor(job.item.locationId);
    if (!access) return NOT_MEMBER();
    if (access === "readonly") return READONLY();

    const parsed = await parseBody(request, serviceCloseSchema);
    if ("response" in parsed) return parsed.response;
    const data = parsed.data;

    const returnedAt = data.returnedAt ?? new Date();
    if (returnedAt < job.sentAt) {
      return apiError("Dönüş tarihi gönderim tarihinden önce olamaz", 422);
    }

    // Garanti kapsamındaki işte ücret sorulmuyor; "ödendi" işareti de anlamsız.
    const underWarranty = data.underWarranty;
    const costMinor = underWarranty ? null : (data.cost ?? null);

    const others = job.item.serviceJobs.filter((other) => other.id !== job.id);

    await prisma.$transaction([
      prisma.serviceJob.update({
        where: { id: job.id },
        data: {
          returnedAt,
          work: data.work ?? null,
          costMinor,
          paid: underWarranty ? false : data.paid,
          underWarranty,
        },
      }),
      prisma.item.update({
        where: { id: job.itemId },
        data: {
          status: statusAfterService(job.item.status, [
            ...others,
            { returnedAt },
          ]),
        },
      }),
    ]);

    return NextResponse.json({ id: job.id });
  });
}

/** Yanlış açılmış kaydı silme. Ekipmanın durumu kalan işlere göre düzeliyor. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ servisId: string }> },
) {
  return guard("servis-sil", async () => {
    const { servisId } = await params;

    const job = await prisma.serviceJob.findUnique({
      where: { id: servisId },
      select: {
        id: true,
        itemId: true,
        item: {
          select: {
            locationId: true,
            status: true,
            serviceJobs: { select: { id: true, returnedAt: true } },
          },
        },
      },
    });
    if (!job) return apiError("Servis kaydı bulunamadı", 404);

    const access = await requireLocationEditor(job.item.locationId);
    if (!access) return NOT_MEMBER();
    if (access === "readonly") return READONLY();

    const others = job.item.serviceJobs.filter((other) => other.id !== job.id);

    await prisma.$transaction([
      prisma.serviceJob.delete({ where: { id: job.id } }),
      prisma.item.update({
        where: { id: job.itemId },
        data: { status: statusAfterService(job.item.status, others) },
      }),
    ]);

    return NextResponse.json({ silindi: true });
  });
}
