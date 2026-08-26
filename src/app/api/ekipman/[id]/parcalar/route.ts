import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { resolveVendor } from "@/lib/seller";
import { partCreateSchema } from "@/lib/validation";

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

  const parsed = await parseBody(request, partCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  // Parçayı temin eden firma da aynı tabloda; satıcı rolüyle işaretleniyor.
  const vendor = await resolveVendor(
    item.locationId,
    data.vendorId,
    data.vendorName,
    "seller",
  );
  if (!vendor.ok) return apiError(vendor.message, 422);

  const part = await prisma.part.create({
    data: {
      itemId: item.id,
      name: data.name,
      partNo: data.partNo ?? null,
      priceMinor: data.price ?? null,
      vendorId: vendor.vendorId,
      stock: data.stock ?? null,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(part, { status: 201 });
}
