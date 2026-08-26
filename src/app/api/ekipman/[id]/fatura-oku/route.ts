import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { toFormValues } from "@/lib/invoice";
import { extractInvoice, isExtractionConfigured } from "@/lib/invoice-extract";
import { fetchFile } from "@/lib/storage";
import { isImage } from "@/lib/upload-rules";

// Çıkarma çağrısı saniyeler sürer; varsayılan süre yetmez (TUZAKLAR #32).
export const maxDuration = 60;

/** Kullanıcı başına saatlik sınır: açık bir uç faturayı şişirir (#37). */
const HOURLY_LIMIT = 20;

const bodySchema = z.object({
  attachmentId: z.string().trim().min(1, "Belge seçilmedi"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isExtractionConfigured()) {
    return apiError(
      "Faturadan okuma kapalı: sunucuda ANTHROPIC_API_KEY tanımlı değil",
      503,
    );
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, locationId: true },
  });
  if (!item) return apiError("Ekipman bulunamadı", 404);

  const access = await requireLocationEditor(item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, bodySchema);
  if ("response" in parsed) return parsed.response;

  const attachment = await prisma.attachment.findFirst({
    where: { id: parsed.data.attachmentId, itemId: item.id },
    select: { id: true, path: true, mimeType: true },
  });
  if (!attachment) return apiError("Belge bulunamadı", 404);

  const mimeType = attachment.mimeType ?? "";
  if (mimeType !== "application/pdf" && !isImage(mimeType)) {
    return apiError("Yalnız PDF ve görsel okunabilir", 422);
  }
  // HEIC'i model almıyor; istemci küçültmesi de HEIC'e dokunmuyor.
  if (mimeType === "image/heic") {
    return apiError("HEIC okunamıyor; fotoğrafı JPEG olarak yükle", 422);
  }

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.invoiceRead.count({
    where: { userId: access.userId, createdAt: { gte: sinceHour } },
  });
  if (recent >= HOURLY_LIMIT) {
    return apiError("Saatlik fatura okuma sınırına ulaştın", 429);
  }

  const bytes = await fetchFile(attachment.path);
  if (!bytes) return apiError("Belge depolamadan okunamadı", 502);

  const base64 = Buffer.from(bytes).toString("base64");
  const result = await extractInvoice(
    mimeType === "application/pdf"
      ? { kind: "pdf", base64 }
      : { kind: "image", mediaType: mimeType, base64 },
  );

  if (!result.ok) {
    console.error("fatura okuma başarısız:", result.message);
    return apiError(result.message, 502);
  }

  // Sunucusuz fonksiyon yanıttan sonra iş yapamaz; kayıt önce yazılıyor
  // (TUZAKLAR #1).
  await prisma.invoiceRead.create({
    data: {
      userId: access.userId,
      itemId: item.id,
      attachmentId: attachment.id,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  });

  // Kaydetmiyoruz: alanlar forma doldurulacak, kullanıcı onaylayacak
  // (CLAUDE.md, TUZAKLAR #36).
  return NextResponse.json({
    kalemler: result.data.items.map((line) => toFormValues(result.data, line)),
    not: result.data.note,
    paraBirimi: result.data.currency,
  });
}
