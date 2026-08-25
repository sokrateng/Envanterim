import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, parseBody } from "@/lib/api";
import { itemCreateSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocationEditor(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, itemCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const item = await prisma.item.create({
    data: {
      locationId: id,
      name: data.name,
      brand: data.brand,
      model: data.model,
      serialNo: data.serialNo,
      place: data.place,
      purchaseDate: data.purchaseDate,
      purchasePriceMinor: data.purchasePrice ?? null,
      warrantyEndDate: data.warrantyEndDate,
      status: data.status,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(item, { status: 201 });
}
