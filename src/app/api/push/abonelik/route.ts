import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UNAUTHENTICATED, apiError, parseBody } from "@/lib/api";
import { isPushConfigured } from "@/lib/push";
import { currentUser } from "@/lib/session";

const subscriptionSchema = z.object({
  endpoint: z.string().url("Geçersiz abonelik adresi"),
  keys: z.object({
    p256dh: z.string().min(1, "Eksik abonelik anahtarı"),
    auth: z.string().min(1, "Eksik abonelik anahtarı"),
  }),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();
  if (!isPushConfigured()) return apiError("Bildirimler kapalı", 503);

  const parsed = await parseBody(request, subscriptionSchema);
  if ("response" in parsed) return parsed.response;
  const { endpoint, keys } = parsed.data;

  // Aynı cihaz yeniden abone olabilir; endpoint tekil, sahibi güncellenir.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      userId: user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ abone: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  const parsed = await parseBody(
    request,
    z.object({ endpoint: z.string().min(1) }),
  );
  if ("response" in parsed) return parsed.response;

  // Yalnız kendi aboneliğini silebilir.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: user.id },
  });

  return NextResponse.json({ abone: false });
}
