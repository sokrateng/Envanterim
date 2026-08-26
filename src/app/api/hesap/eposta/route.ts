import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UNAUTHENTICATED, apiError, parseBody } from "@/lib/api";
import {
  codeExpiry,
  generateCode,
  normalizeEmail,
  verificationMail,
} from "@/lib/email-message";
import { isEmailConfigured, sendMail } from "@/lib/mailer";
import { currentUser } from "@/lib/session";

const emailSchema = z.object({ email: z.string() });
const prefSchema = z.object({ hatirlatma: z.boolean() });

/** Adres ekler ve doğrulama kodu gönderir. Kod gitmeden adres bağlanmıyor. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();
  if (!isEmailConfigured()) return apiError("E-posta bildirimi kapalı", 503);

  const parsed = await parseBody(request, emailSchema);
  if ("response" in parsed) return parsed.response;

  const email = normalizeEmail(parsed.data.email);
  if (!email) return apiError("Geçerli bir e-posta adresi yaz", 422);

  const taken = await prisma.user.findFirst({
    where: { email, NOT: { id: user.id } },
    select: { id: true },
  });
  if (taken) return apiError("Bu adres başka bir hesapta kayıtlı", 409);

  const code = generateCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      // Adres değişince doğrulama sıfırlanır.
      emailVerifiedAt: null,
      emailCodeHash: await bcrypt.hash(code, 10),
      emailCodeExpiresAt: codeExpiry(),
      emailCodeTries: 0,
    },
  });

  // Gönderim await ediliyor (TUZAKLAR #1).
  const result = await sendMail(email, verificationMail(code));
  if (!result.ok) return apiError(result.error ?? "E-posta gönderilemedi", 502);

  return NextResponse.json({ gonderildi: true }, { status: 201 });
}

/** Bildirim tercihini değiştirir. */
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  const parsed = await parseBody(request, prefSchema);
  if ("response" in parsed) return parsed.response;

  await prisma.user.update({
    where: { id: user.id },
    data: { emailReminders: parsed.data.hatirlatma },
  });

  return NextResponse.json({ hatirlatma: parsed.data.hatirlatma });
}

/**
 * Adresi kaldırır; bundan sonra e-posta gitmez. Tercih de varsayılana
 * dönüyor: kullanıcı sonra yeni bir adres eklerse eski "kapalı" ayarını
 * devralmasın.
 */
export async function DELETE() {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: null,
      emailVerifiedAt: null,
      emailReminders: true,
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      emailCodeTries: 0,
    },
  });

  return NextResponse.json({ silindi: true });
}
