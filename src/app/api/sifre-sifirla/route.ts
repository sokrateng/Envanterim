import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError, parseBody } from "@/lib/api";
import {
  CODE_MAX_TRIES,
  codeExpiry,
  generateCode,
  isValidCode,
  resetMail,
} from "@/lib/email-message";
import { isEmailConfigured, sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { resetConfirmSchema, resetRequestSchema } from "@/lib/validation";

/**
 * Şifre sıfırlama — girişsiz uç.
 *
 * İki kural: yanıt hiçbir zaman "böyle bir kullanıcı yok" demiyor (kullanıcı
 * adı sızmasın), ve kod yalnız **doğrulanmış** adrese gidiyor. Adres
 * doğrulanmamışsa sıfırlama yapılamıyor; o hesabın sahibi olduğunu gösteren
 * bir kanal yok demektir.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, resetRequestSchema);
  if ("response" in parsed) return parsed.response;

  if (!isEmailConfigured()) {
    return apiError("E-posta kapalı: şifre sıfırlama kullanılamıyor", 503);
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username.toLowerCase() },
    select: { id: true, email: true, emailVerifiedAt: true },
  });

  // Kullanıcı yoksa ya da adresi doğrulanmamışsa da aynı yanıt.
  if (user?.email && user.emailVerifiedAt) {
    const code = generateCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetCodeHash: await bcrypt.hash(code, 10),
        resetCodeExpiresAt: codeExpiry(),
        resetCodeTries: 0,
      },
    });
    // Gönderimi await et (TUZAKLAR #1).
    await sendMail(user.email, resetMail(code));
  }

  return NextResponse.json({
    gonderildi: true,
    bilgi: "Hesabın doğrulanmış bir adresi varsa kod gönderildi.",
  });
}

/** Kodla yeni şifre. */
export async function PATCH(request: Request) {
  const parsed = await parseBody(request, resetConfirmSchema);
  if ("response" in parsed) return parsed.response;

  const { username, kod, yeni } = parsed.data;
  if (!isValidCode(kod)) return apiError("Kod altı haneli olmalı", 422);

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      resetCodeHash: true,
      resetCodeExpiresAt: true,
      resetCodeTries: true,
    },
  });

  // Yanlış kullanıcı adı ile yanlış kod aynı yanıtı alıyor.
  if (!user?.resetCodeHash || !user.resetCodeExpiresAt) {
    return apiError("Kod geçersiz", 422);
  }
  if (user.resetCodeExpiresAt.getTime() < Date.now()) {
    return apiError("Kodun süresi doldu, yenisini iste", 410);
  }
  if (user.resetCodeTries >= CODE_MAX_TRIES) {
    return apiError("Çok fazla deneme. Yeni kod iste", 429);
  }

  const dogru = await bcrypt.compare(kod.trim(), user.resetCodeHash);
  if (!dogru) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetCodeTries: { increment: 1 } },
    });
    return apiError("Kod geçersiz", 422);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(yeni, 10),
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      resetCodeTries: 0,
    },
  });

  return NextResponse.json({ degisti: true });
}
