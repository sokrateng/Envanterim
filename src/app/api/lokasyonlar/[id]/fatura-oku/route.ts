import { NextResponse } from "next/server";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard } from "@/lib/api";
import { EXTRACTION_OFF, isExtractionConfigured } from "@/lib/invoice-extract";
import { readInvoice } from "@/lib/invoice-read";
import { MAX_UPLOAD_BYTES, isAllowedType } from "@/lib/upload-rules";

// Çıkarma çağrısı saniyeler sürer; varsayılan süre yetmez (TUZAKLAR #32).
export const maxDuration = 60;

/**
 * Ekipman açılmadan faturadan okuma: yeni ekipman formunda elindeki faturayı
 * taratıp alanları doldurmak için.
 *
 * Dosya doğrudan gövdede geliyor, depoya yazılmıyor: henüz bağlanacağı bir
 * ekipman yok ve okuma kaydetmiyor. Kullanıcı formu kaydettiğinde fatura ayrıca
 * ek olarak yükleniyor — o zaman ekipman kimliği var.
 *
 * Yetki lokasyon üyeliğinden geçiyor (CLAUDE.md): okuma bir lokasyonun kotasını
 * harcıyor, üyesi olmayan tetikleyemez.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("lokasyon-fatura-oku", async () => {
    const { id } = await params;

    if (!isExtractionConfigured()) return apiError(EXTRACTION_OFF, 503);

    const access = await requireLocationEditor(id);
    if (!access) return NOT_MEMBER();
    if (access === "readonly") return READONLY();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("Dosya okunamadı", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return apiError("Dosya gerekli", 422);
    if (!isAllowedType(file.type)) {
      return apiError("Yalnız JPG, PNG, WebP ve PDF okunabilir", 422);
    }

    const bytes = await file.arrayBuffer();
    // Bildirilen boyuta değil gerçek gövdeye de bak (TUZAKLAR #31).
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return apiError("Dosya 4 MB'dan büyük olamaz", 413);
    }
    if (bytes.byteLength === 0) return apiError("Dosya boş", 422);

    const outcome = await readInvoice({
      userId: access.userId,
      mimeType: file.type,
      bytes,
    });

    if (!outcome.ok) return apiError(outcome.message, outcome.status);
    return NextResponse.json(outcome.body);
  });
}
