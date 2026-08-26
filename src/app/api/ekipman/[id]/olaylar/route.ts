import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { resolveVendor } from "@/lib/seller";
import { eventCreateSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, locationId: true },
  });
  if (!item) return apiError("Ekipman bulunamadı", 404);

  const access = await requireLocationEditor(item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, eventCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  let vendorId: string | null = null;
  if (data.kind === "SERVICE") {
    const vendor = await resolveVendor(
      item.locationId,
      data.vendorId,
      data.vendorName,
      "service",
    );
    if (!vendor.ok) return apiError(vendor.message, 422);
    vendorId = vendor.vendorId;
  }

  let assignedToUserId: string | null = null;
  if (data.kind === "ASSIGNMENT" && data.assignedToUserId) {
    // Zimmet ancak lokasyonun üyesine verilebilir: üye olmayan birine
    // zimmetlemek onu göremeyeceği bir kayda bağlardı.
    const member = await prisma.locationMember.findUnique({
      where: {
        locationId_userId: {
          locationId: item.locationId,
          userId: data.assignedToUserId,
        },
      },
      select: { userId: true },
    });
    if (!member) return apiError("Bu kişi lokasyonun üyesi değil", 422);
    assignedToUserId = member.userId;
  }

  const event = await prisma.itemEvent.create({
    data: {
      itemId: item.id,
      kind: data.kind,
      date: data.date,
      note: data.note ?? null,
      vendorId,
      costMinor: data.kind === "SERVICE" ? (data.cost ?? null) : null,
      readingValue: data.kind === "READING" ? data.readingValue : null,
      readingUnit: data.kind === "READING" ? (data.readingUnit ?? null) : null,
      assignedToUserId,
      assignedPlace:
        data.kind === "ASSIGNMENT" ? (data.assignedPlace ?? null) : null,
    },
    select: { id: true, kind: true, date: true },
  });

  return NextResponse.json(event, { status: 201 });
}
