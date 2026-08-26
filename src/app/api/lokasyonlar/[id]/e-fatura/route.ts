import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";
import { parseUblInvoice, unitCount } from "@/lib/einvoice";
import { parseDateOnly, priceToMinor } from "@/lib/invoice";
import { resolveVendor } from "@/lib/seller";

export const maxDuration = 60;

const confirmSchema = z.object({
  xml: z.string().min(1),
  // Kullanıcının seçtiği kalem sıraları.
  secilen: z.array(z.number().int().min(0)).min(1, "En az bir kalem seç"),
});

/**
 * e-Arşiv/e-Fatura XML'inden ekipman oluşturma. Ayrıştırma deterministik,
 * modele gitmiyor (docs/MIMARI.md §6). Yine de kullanıcı hangi kalemlerin
 * ekipman olduğunu seçiyor: faturada kargo, hizmet, sarf da olabiliyor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocationEditor(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const contentType = request.headers.get("content-type") ?? "";

  // 1. adım: dosya gelir, önizleme döner. Hiçbir şey kaydedilmez.
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return apiError("Dosya okunamadı", 400);

    const file = form.get("file");
    if (!(file instanceof File)) return apiError("Dosya gerekli", 422);
    if (file.size > 5 * 1024 * 1024) return apiError("Dosya 5 MB'dan büyük", 413);

    const xml = await file.text();
    const parsed = parseUblInvoice(xml);
    if (!parsed.ok) return apiError(parsed.message, 422);

    return NextResponse.json({
      xml,
      satici: parsed.invoice.sellerName,
      tarih: parsed.invoice.invoiceDate,
      faturaNo: parsed.invoice.invoiceNumber,
      paraBirimi: parsed.invoice.currency,
      kalemler: parsed.invoice.lines.map((line, index) => ({
        sira: index,
        ad: line.name,
        marka: line.brand,
        model: line.model,
        birimFiyat: line.unitPrice,
        adet: unitCount(line.quantity),
      })),
    });
  }

  // 2. adım: kullanıcı seçtiklerini onaylar, ekipmanlar açılır.
  const body = await request.json().catch(() => null);
  const parsedBody = confirmSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(parsedBody.error.issues[0]?.message ?? "Geçersiz istek", 422);
  }

  const parsed = parseUblInvoice(parsedBody.data.xml);
  if (!parsed.ok) return apiError(parsed.message, 422);

  const invoice = parsed.invoice;
  const purchaseDate = parseDateOnly(invoice.invoiceDate);
  const vendor = await resolveVendor(
    id,
    undefined,
    invoice.sellerName ?? undefined,
    "seller",
  );

  let created = 0;
  for (const index of parsedBody.data.secilen) {
    const line = invoice.lines[index];
    if (!line) continue;

    const priceMinor = priceToMinor(line.unitPrice);
    const count = unitCount(line.quantity);

    for (let copy = 0; copy < count; copy += 1) {
      await prisma.item.create({
        data: {
          locationId: id,
          name: line.name,
          brand: line.brand,
          model: line.model,
          purchaseDate,
          purchasePriceMinor: priceMinor,
          currency: (invoice.currency ?? "TRY").slice(0, 3),
          sellerId: vendor.ok ? vendor.vendorId : null,
          status: "IN_USE",
        },
      });
      created += 1;
    }
  }

  return NextResponse.json({ eklenen: created });
}
