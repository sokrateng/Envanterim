import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard, parseBody } from "@/lib/api";
import { EXTRACTION_OFF, isExtractionConfigured } from "@/lib/invoice-extract";
import { readInvoice } from "@/lib/invoice-read";
import { fetchFile } from "@/lib/storage";

// Çıkarma çağrısı saniyeler sürer; varsayılan süre yetmez (TUZAKLAR #32).
export const maxDuration = 60;

const bodySchema = z.object({
  attachmentId: z.string().trim().min(1, "Belge seçilmedi"),
});

/** Var olan ekipmanın ekinden okuma. Dosya zaten depoda; sunucu oradan alıyor. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("fatura-oku", async () => {
    const { id } = await params;

    if (!isExtractionConfigured()) return apiError(EXTRACTION_OFF, 503);

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

    const bytes = await fetchFile(attachment.path);
    if (!bytes) return apiError("Belge depolamadan okunamadı", 502);

    const outcome = await readInvoice({
      userId: access.userId,
      mimeType: attachment.mimeType ?? "",
      bytes,
      itemId: item.id,
      attachmentId: attachment.id,
    });

    if (!outcome.ok) return apiError(outcome.message, outcome.status);
    return NextResponse.json(outcome.body);
  });
}
