import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { loadFieldDefs, validateCustomFields } from "@/lib/item-fields";
import { resolveSeller } from "@/lib/seller";
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

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, locationId: id },
      select: { id: true },
    });
    if (!category) return apiError("Kategori bu lokasyona ait değil", 422);
  }

  // Dinamik alanlar veritabanı tarafında tip zorlamıyor; şema kategori
  // tanımlarından çalışma anında üretilir (CLAUDE.md).
  const fields = await loadFieldDefs(data.categoryId, id);
  const custom = validateCustomFields(data.customFields, fields, {});
  if (!custom.ok) return apiError(custom.message, 422);

  const seller = await resolveSeller(id, data.sellerId, data.sellerName);
  if (!seller.ok) return apiError(seller.message, 422);

  const item = await prisma.item.create({
    data: {
      locationId: id,
      categoryId: data.categoryId ?? null,
      sellerId: seller.sellerId,
      name: data.name,
      brand: data.brand,
      model: data.model,
      serialNo: data.serialNo,
      place: data.place,
      purchaseDate: data.purchaseDate,
      purchasePriceMinor: data.purchasePrice ?? null,
      currency: data.currency,
      warrantyEndDate: data.warrantyEndDate,
      status: data.status,
      customFields: custom.values,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(item, { status: 201 });
}
