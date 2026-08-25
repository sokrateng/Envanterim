import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiError, parseBody } from "@/lib/api";
import { inviteState } from "@/lib/invite";
import { registerSchema } from "@/lib/validation";

/**
 * Davet kodu ile hesap açma. Uç herkese açık; tek koruma davet kodunun
 * kendisi: 10 karakter, 31 harflik alfabe, tek kullanımlık ve 7 gün geçerli.
 */
/** Aynı kodu iki isteğin birlikte kullanmasını işaretleyen iç hata. */
const RACE = "DAVET_KULLANILMIS";

export async function POST(request: Request) {
  const parsed = await parseBody(request, registerSchema);
  if ("response" in parsed) return parsed.response;
  const { code, name, username, password } = parsed.data;

  const invite = await prisma.locationInvite.findUnique({
    where: { code },
    select: {
      id: true,
      role: true,
      locationId: true,
      usedAt: true,
      expiresAt: true,
      location: { select: { name: true } },
    },
  });
  // Geçersiz kodda "yok" ile "kullanılmış" ayrımını dışarı vermiyoruz.
  if (!invite) return apiError("Davet kodu geçersiz", 404);

  const state = inviteState(invite);
  if (state === "used") return apiError("Bu davet kodu kullanılmış", 409);
  if (state === "expired") return apiError("Bu davet kodunun süresi dolmuş", 409);

  const taken = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (taken) return apiError("Bu kullanıcı adı alınmış", 409);

  // Hash işlemi yüz milisaniye sürer; işlemin dışında yapılır ki
  // transaction o süre boyunca satır kilitlemesin.
  const passwordHash = await bcrypt.hash(password, 10);

  // Hesap, üyelik ve davetin damgalanması tek işlemde: yarıda kalırsa kod
  // yanmasın, üyeliksiz hesap kalmasın.
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          username,
          passwordHash,
          status: "ACTIVE",
          inviteCode: code,
        },
        select: { id: true, username: true },
      });

      await tx.locationMember.create({
        data: {
          locationId: invite.locationId,
          userId: created.id,
          role: invite.role,
        },
      });

      // Yarışta ikinci istek aynı kodu kullanamasın: koşul usedAt = null.
      const stamped = await tx.locationInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date(), usedById: created.id },
      });
      if (stamped.count === 0) throw new Error(RACE);

      return created;
    });

    return NextResponse.json(
      { username: user.username, lokasyon: invite.location.name },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === RACE) {
      return apiError("Bu davet kodu kullanılmış", 409);
    }
    throw error;
  }
}
