import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UNAUTHENTICATED, apiError, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { passwordChangeSchema } from "@/lib/validation";

/** Şifre değiştirme. Mevcut şifre soruluyor: açık kalan telefon yeterli olmasın. */
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  const parsed = await parseBody(request, passwordChangeSchema);
  if ("response" in parsed) return parsed.response;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return UNAUTHENTICATED();

  const dogru = await bcrypt.compare(parsed.data.mevcut, row.passwordHash);
  if (!dogru) return apiError("Mevcut şifre yanlış", 403);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.yeni, 10),
      // Bekleyen bir sıfırlama kodu varsa geçersiz kalsın.
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      resetCodeTries: 0,
    },
  });

  return NextResponse.json({ degisti: true });
}
