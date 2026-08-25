import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { loadFieldDefs, validateCustomFields } from "@/lib/item-fields";
import { resolveSeller } from "@/lib/seller";
import { itemUpdateSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, locationId: true, customFields: true },
  });
  if (!item) return apiError("Ekipman bulunamadı", 404);

  const access = await requireLocationEditor(item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, itemUpdateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, locationId: item.locationId },
      select: { id: true },
    });
    if (!category) return apiError("Kategori bu lokasyona ait değil", 422);
  }

  const fields = await loadFieldDefs(data.categoryId, item.locationId);
  // Eski değerler mevcut kayıttan geçer: gizlenmiş ya da tanımı kalkmış
  // alanların değeri kaybolmasın (TUZAKLAR #25, #26).
  const custom = validateCustomFields(data.customFields, fields, item.customFields);
  if (!custom.ok) return apiError(custom.message, 422);

  const seller = await resolveSeller(
    item.locationId,
    data.sellerId,
    data.sellerName,
  );
  if (!seller.ok) return apiError(seller.message, 422);

  const updated = await prisma.item.update({
    where: { id: item.id },
    data: {
      categoryId: data.categoryId ?? null,
      sellerId: seller.sellerId,
      name: data.name,
      brand: data.brand ?? null,
      model: data.model ?? null,
      serialNo: data.serialNo ?? null,
      place: data.place ?? null,
      purchaseDate: data.purchaseDate ?? null,
      purchasePriceMinor: data.purchasePrice ?? null,
      warrantyEndDate: data.warrantyEndDate ?? null,
      status: data.status,
      customFields: custom.values,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(updated);
}
