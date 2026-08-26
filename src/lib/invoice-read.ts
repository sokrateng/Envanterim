import "server-only";

import { INVOICE_READ_HOURLY_LIMIT } from "@/lib/constants";
import { toFormValues } from "@/lib/invoice";
import { extractInvoice } from "@/lib/invoice-extract";
import { prisma } from "@/lib/prisma";
import { isImage } from "@/lib/upload-rules";

/**
 * Faturadan okuma iki yerden çağrılıyor: var olan ekipmanın ekinden ve yeni
 * ekipman formundan (ekipman henüz yokken). Sınır, tür denetimi, sayaç ve
 * yanıt biçimi ikisinde de aynı olmalı — o yüzden burada, tek yerde.
 *
 * Sonuç kaydedilmiyor: forma doldurulup kullanıcıya onaylatılıyor
 * (CLAUDE.md, TUZAKLAR #36).
 */

export type InvoiceReadInput = {
  userId: string;
  mimeType: string;
  bytes: ArrayBuffer;
  /** Ekipman ve ek, okuma sonradan yapılıyorsa dolu; formdan geliyorsa null. */
  itemId?: string | null;
  attachmentId?: string | null;
};

export type InvoiceReadPayload = {
  kalemler: ReturnType<typeof toFormValues>[];
  not: string | null;
  paraBirimi: string | null;
};

export type InvoiceReadOutcome =
  | { ok: true; body: InvoiceReadPayload }
  | { ok: false; message: string; status: number };

/** Modele gidebilen tür mü: PDF ya da HEIC olmayan görsel. */
export function readableType(mimeType: string): { ok: true } | { ok: false; message: string } {
  if (mimeType === "application/pdf") return { ok: true };
  if (!isImage(mimeType)) {
    return { ok: false, message: "Yalnız PDF ve görsel okunabilir" };
  }
  // HEIC'i model almıyor; istemci küçültmesi de HEIC'e dokunmuyor.
  if (mimeType === "image/heic") {
    return { ok: false, message: "HEIC okunamıyor; fotoğrafı JPEG olarak yükle" };
  }
  return { ok: true };
}

export async function readInvoice(
  input: InvoiceReadInput,
): Promise<InvoiceReadOutcome> {
  const type = readableType(input.mimeType);
  if (!type.ok) return { ok: false, message: type.message, status: 422 };

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.invoiceRead.count({
    where: { userId: input.userId, createdAt: { gte: sinceHour } },
  });
  if (recent >= INVOICE_READ_HOURLY_LIMIT) {
    return {
      ok: false,
      message: "Saatlik fatura okuma sınırına ulaştın",
      status: 429,
    };
  }

  const base64 = Buffer.from(input.bytes).toString("base64");
  const result = await extractInvoice(
    input.mimeType === "application/pdf"
      ? { kind: "pdf", base64 }
      : { kind: "image", mediaType: input.mimeType, base64 },
  );

  if (!result.ok) {
    console.error("fatura okuma başarısız:", result.message);
    return { ok: false, message: result.message, status: 502 };
  }

  // Sunucusuz fonksiyon yanıttan sonra iş yapamaz; sayaç önce yazılıyor
  // (TUZAKLAR #1).
  await prisma.invoiceRead.create({
    data: {
      userId: input.userId,
      itemId: input.itemId ?? null,
      attachmentId: input.attachmentId ?? null,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  });

  return {
    ok: true,
    body: {
      kalemler: result.data.items.map((line) => toFormValues(result.data, line)),
      not: result.data.note,
      paraBirimi: result.data.currency,
    },
  };
}
