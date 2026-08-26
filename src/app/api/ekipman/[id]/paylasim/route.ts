import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { expiryFromNow, generateToken, isValidDuration } from "@/lib/share";

const createSchema = z.object({
  gun: z.coerce.number().int(),
});

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

  const parsed = await parseBody(request, createSchema);
  if ("response" in parsed) return parsed.response;
  if (!isValidDuration(parsed.data.gun)) {
    return apiError("Geçersiz süre", 422);
  }

  // Anahtar çarpışması pratikte olmaz ama benzersizlik kısıtı veritabanında;
  // sessiz 500 yerine birkaç kez dene.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateToken();
    const existing = await prisma.shareLink.findUnique({
      where: { token },
      select: { id: true },
    });
    if (existing) continue;

    const link = await prisma.shareLink.create({
      data: {
        token,
        itemId: item.id,
        createdById: access.userId,
        expiresAt: expiryFromNow(parsed.data.gun),
      },
      select: { id: true, token: true, expiresAt: true },
    });
    return NextResponse.json(link, { status: 201 });
  }

  return apiError("Bağlantı üretilemedi, tekrar dene", 500);
}
