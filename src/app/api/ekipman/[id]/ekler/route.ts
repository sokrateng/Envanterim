import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";
import { ATTACHMENT_KINDS } from "@/lib/constants";
import { storeFile } from "@/lib/storage";
import {
  MAX_UPLOAD_BYTES,
  checkUpload,
  safeDisplayName,
  storagePath,
} from "@/lib/upload-rules";

// Yükleme saniyeler sürebilir; varsayılan süre yetmezse istek yarıda kesilir
// (TUZAKLAR #32).
export const maxDuration = 60;

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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Dosya okunamadı", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Dosya gerekli", 422);

  const check = checkUpload(
    { type: file.type, size: file.size },
    String(form.get("kind") ?? "OTHER"),
    ATTACHMENT_KINDS,
  );
  if (!check.ok) return apiError(check.message, 422);

  const buffer = await file.arrayBuffer();
  // Bildirilen boyuta değil gerçek gövdeye de bak.
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return apiError("Dosya 4 MB'dan büyük olamaz", 413);
  }

  const objectPath = storagePath(item.id, randomUUID(), file.type);

  let stored;
  try {
    stored = await storeFile(objectPath, buffer, file.type);
  } catch (error) {
    console.error("ek yüklenemedi", error);
    return apiError("Dosya yüklenemedi", 502);
  }

  const attachment = await prisma.attachment.create({
    data: {
      itemId: item.id,
      url: stored.url,
      path: stored.storagePath,
      name: safeDisplayName(file.name),
      kind: check.kind,
      mimeType: file.type,
    },
    select: { id: true, url: true, name: true, kind: true, mimeType: true },
  });

  return NextResponse.json(attachment, { status: 201 });
}
