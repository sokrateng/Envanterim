import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UNAUTHENTICATED, apiError, parseBody } from "@/lib/api";
import { CODE_MAX_TRIES, isValidCode } from "@/lib/email-message";
import { currentUser } from "@/lib/session";

const codeSchema = z.object({ kod: z.string() });

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  const parsed = await parseBody(request, codeSchema);
  if ("response" in parsed) return parsed.response;

  const code = parsed.data.kod.trim();
  if (!isValidCode(code)) return apiError("Kod altı haneli olmalı", 422);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      emailCodeHash: true,
      emailCodeExpiresAt: true,
      emailCodeTries: true,
    },
  });
  if (!record?.email || !record.emailCodeHash || !record.emailCodeExpiresAt) {
    return apiError("Önce adres ekle", 409);
  }

  if (record.emailCodeExpiresAt.getTime() <= Date.now()) {
    return apiError("Kodun süresi doldu, yenisini iste", 410);
  }

  // Deneme sayısı sınırlı: altı haneli kod kaba kuvvetle bulunmasın.
  if (record.emailCodeTries >= CODE_MAX_TRIES) {
    return apiError("Çok fazla denedin, yeni kod iste", 429);
  }

  const ok = await bcrypt.compare(code, record.emailCodeHash);
  if (!ok) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailCodeTries: { increment: 1 } },
    });
    return apiError("Kod hatalı", 422);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      emailCodeTries: 0,
    },
  });

  return NextResponse.json({ dogrulandi: true });
}
