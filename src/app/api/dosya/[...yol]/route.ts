import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { requireLocation } from "@/lib/access";
import { NOT_MEMBER, apiError } from "@/lib/api";
import { isValidToken, shareState } from "@/lib/share";
import { localFilePath } from "@/lib/storage";

/**
 * Yerel diske düşen ekleri sunar (Supabase kurulmadan geliştirme için).
 * Dosya yolu doğrudan diskten okunmaz: önce kayıtta aranır, sonra o ekin
 * lokasyonuna üyelik sorulur. Böylece yol uydurup dosya çekilemez.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ yol: string[] }> },
) {
  const { yol } = await params;
  const objectPath = yol.join("/");

  const attachment = await prisma.attachment.findFirst({
    where: { path: objectPath },
    select: {
      mimeType: true,
      itemId: true,
      item: { select: { locationId: true } },
    },
  });
  if (!attachment) return apiError("Dosya bulunamadı", 404);

  // Salt-okunur paylaşım: geçerli bir bağlantı anahtarı, yalnız o ekipmanın
  // dosyalarını açar. Anahtar yoksa üyelik sorulur.
  const shareToken = new URL(request.url).searchParams.get("p");
  if (shareToken) {
    if (!isValidToken(shareToken)) return apiError("Dosya bulunamadı", 404);

    const link = await prisma.shareLink.findUnique({
      where: { token: shareToken },
      select: { itemId: true, expiresAt: true, revokedAt: true },
    });
    if (
      !link ||
      link.itemId !== attachment.itemId ||
      shareState(link) !== "valid"
    ) {
      return apiError("Dosya bulunamadı", 404);
    }
  } else {
    const access = await requireLocation(attachment.item.locationId);
    if (!access) return NOT_MEMBER();
  }

  const filePath = localFilePath(objectPath);
  try {
    const info = await stat(filePath);
    const stream = Readable.toWeb(
      createReadStream(filePath),
    ) as unknown as ReadableStream;

    return new Response(stream, {
      headers: {
        "Content-Type": attachment.mimeType ?? "application/octet-stream",
        "Content-Length": String(info.size),
        // Ek kimlik doğrulamalı; ara katmanlar önbelleğe almasın.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return apiError("Dosya bulunamadı", 404);
  }
}
