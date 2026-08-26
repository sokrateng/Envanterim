import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocation, requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";
import { toCsv, toTable } from "@/lib/csv";
import { ownershipCostMinor, type TimelineEvent } from "@/lib/events";
import {
  CSV_COLUMNS,
  DERIVED_COLUMNS,
  buildMapping,
  itemToRow,
  missingRequired,
  parseImportRows,
} from "@/lib/item-csv";
import { resolveVendor } from "@/lib/seller";

export const maxDuration = 60;

/** Dışa aktarma: lokasyonun tüm ekipmanları, sahip olma maliyetiyle. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) return NOT_MEMBER();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      name: true,
      items: {
        select: {
          name: true,
          brand: true,
          model: true,
          serialNo: true,
          place: true,
          status: true,
          currency: true,
          purchaseDate: true,
          purchasePriceMinor: true,
          warrantyEndDate: true,
          category: { select: { name: true } },
          seller: { select: { name: true } },
          events: { select: { kind: true, costMinor: true } },
          parts: { select: { priceMinor: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!location) return apiError("Lokasyon bulunamadı", 404);

  const rows = location.items.map((item) =>
    itemToRow({
      name: item.name,
      brand: item.brand,
      model: item.model,
      serialNo: item.serialNo,
      categoryName: item.category?.name ?? null,
      place: item.place,
      status: item.status,
      sellerName: item.seller?.name ?? null,
      purchaseDate: item.purchaseDate,
      purchasePriceMinor: item.purchasePriceMinor,
      currency: item.currency,
      warrantyEndDate: item.warrantyEndDate,
      ownershipCostMinor: ownershipCostMinor(
        item.purchasePriceMinor,
        item.events.map((event) => ({
          kind: event.kind as TimelineEvent["kind"],
          costMinor: event.costMinor,
        })),
        item.parts.map((part) => part.priceMinor),
      ),
    }),
  );

  const csv = toCsv(rows, [...CSV_COLUMNS, ...DERIVED_COLUMNS]);
  const fileName = `envanter-${location.name.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * İçe aktarma. `onayla` gelmeden hiçbir şey kaydedilmez: önce önizleme
 * dönülür, kullanıcı görüp onaylar. Faturadan okumada olduğu gibi, dışarıdan
 * gelen veri kullanıcı görmeden kaydedilmiyor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocationEditor(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const form = await request.formData().catch(() => null);
  if (!form) return apiError("Dosya okunamadı", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Dosya gerekli", 422);
  if (file.size > 2 * 1024 * 1024) return apiError("Dosya 2 MB'dan büyük", 413);

  const text = await file.text();
  const table = toTable(text);
  if (table.rows.length === 0) return apiError("Dosyada satır yok", 422);
  if (table.rows.length > 1000) return apiError("En çok 1000 satır alınır", 422);

  const mapping = buildMapping(table.headers);
  const missing = missingRequired(mapping);
  if (missing.length) {
    return apiError(`Şu sütun eksik: ${missing.join(", ")}`, 422);
  }

  const preview = parseImportRows(table.rows, mapping);
  const confirm = String(form.get("onayla") ?? "") === "evet";

  if (!confirm) {
    return NextResponse.json({
      onaylanacak: preview.ready.length,
      hatali: preview.failed,
      ornek: preview.ready.slice(0, 5).map((row) => ({
        ad: row.name,
        marka: row.brand,
        durum: row.status,
      })),
    });
  }

  // Kategori ve satıcı adları ada göre eşleşir; yoksa açılır.
  const categories = await prisma.category.findMany({
    where: { locationId: id },
    select: { id: true, name: true },
  });
  const categoryByName = new Map(
    categories.map((category) => [category.name.toLocaleLowerCase("tr"), category.id]),
  );

  let created = 0;
  for (const row of preview.ready) {
    let categoryId: string | null = null;
    if (row.categoryName) {
      const key = row.categoryName.toLocaleLowerCase("tr");
      const existing = categoryByName.get(key);
      if (existing) {
        categoryId = existing;
      } else {
        const category = await prisma.category.create({
          data: { locationId: id, name: row.categoryName },
          select: { id: true },
        });
        categoryByName.set(key, category.id);
        categoryId = category.id;
      }
    }

    const vendor = await resolveVendor(id, undefined, row.sellerName ?? undefined, "seller");

    await prisma.item.create({
      data: {
        locationId: id,
        categoryId,
        name: row.name,
        brand: row.brand,
        model: row.model,
        serialNo: row.serialNo,
        place: row.place,
        status: row.status,
        sellerId: vendor.ok ? vendor.vendorId : null,
        purchaseDate: row.purchaseDate,
        purchasePriceMinor: row.purchasePriceMinor,
        currency: row.currency,
        warrantyEndDate: row.warrantyEndDate,
      },
    });
    created += 1;
  }

  return NextResponse.json({ eklenen: created, hatali: preview.failed });
}
