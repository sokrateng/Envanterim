import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getLocationAccess } from "@/lib/access";
import { NOT_MEMBER, apiError, guard } from "@/lib/api";
import { NOTE_MAX, NOTE_PHOTO_LIMIT } from "@/lib/notes";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import {
  MAX_UPLOAD_BYTES,
  isImage,
  safeDisplayName,
  storagePath,
} from "@/lib/upload-rules";

// Fotoğraf yükleme saniyeler sürebilir (TUZAKLAR #32).
export const maxDuration = 60;

/**
 * Ekipmana not ekleme. Metin ve fotoğraflar tek istekte geliyor: not önce
 * yazılıp fotoğraflar sonra yüklenseydi, yarım kalan istekte fotoğrafsız not
 * kalırdı.
 *
 * Not yazmak için üye olmak yeter — görüntüleyen de yazabiliyor. Envanteri
 * kullanan kişi çoğu zaman düzenleyen değil; tarifi, ayarı, uyarıyı o biliyor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("not-ekle", async () => {
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, locationId: true },
    });
    if (!item) return apiError("Ekipman bulunamadı", 404);

    const access = await getLocationAccess(item.locationId);
    if (!access) return NOT_MEMBER();

    // Yazarın adı kayda düşüyor: hesap silinse de "kim yazmış" kalsın.
    // Oturumdaki ad her zaman dolu olmadığı için kaynağından okunuyor.
    const author = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { name: true },
    });
    if (!author) return NOT_MEMBER();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("İstek okunamadı", 400);
    }

    const body = String(form.get("body") ?? "").trim();
    if (!body) return apiError("Not boş olamaz", 422);
    if (body.length > NOTE_MAX) {
      return apiError(`Not en çok ${NOTE_MAX} karakter olabilir`, 422);
    }

    const files = form
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > NOTE_PHOTO_LIMIT) {
      return apiError(`Bir nota en çok ${NOTE_PHOTO_LIMIT} fotoğraf eklenir`, 422);
    }
    for (const file of files) {
      if (!isImage(file.type)) {
        return apiError("Nota yalnız fotoğraf eklenir", 422);
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return apiError("Fotoğraf 4 MB'dan büyük olamaz", 413);
      }
    }

    // Dosyalar önce depoya, sonra tek işlemde veritabanına: yarıda kalan
    // yükleme kayıtsız dosya bırakır (yeri belli, temizlenebilir), tersi
    // dosyasız kayıt bırakırdı ve arayüzde kırık görsel olurdu.
    const stored: Array<{ url: string; path: string; name: string; mimeType: string }> = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      // Bildirilen boyuta değil gerçek gövdeye de bak (TUZAKLAR #31).
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        return apiError("Fotoğraf 4 MB'dan büyük olamaz", 413);
      }
      const objectPath = storagePath(item.id, randomUUID(), file.type);
      const result = await storeFile(objectPath, bytes, file.type);
      stored.push({
        url: result.url,
        path: result.storagePath,
        name: safeDisplayName(file.name, "fotoğraf"),
        mimeType: file.type,
      });
    }

    const note = await prisma.itemNote.create({
      data: {
        itemId: item.id,
        userId: access.userId,
        authorName: author.name,
        body,
        attachments: {
          create: stored.map((file) => ({
            itemId: item.id,
            url: file.url,
            path: file.path,
            name: file.name,
            kind: "PHOTO",
            mimeType: file.mimeType,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json(note, { status: 201 });
  });
}
