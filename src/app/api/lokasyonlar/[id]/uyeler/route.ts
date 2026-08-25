import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { memberInviteSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, memberInviteSchema);
  if ("response" in parsed) return parsed.response;

  const invitee = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, name: true, username: true, status: true },
  });
  if (!invitee) return apiError("Bu kullanıcı adı bulunamadı", 404);
  if (invitee.status === "FROZEN") return apiError("Bu hesap donduruldu", 409);

  const existing = await prisma.locationMember.findUnique({
    where: { locationId_userId: { locationId: id, userId: invitee.id } },
    select: { id: true },
  });
  if (existing) return apiError("Bu kişi zaten üye", 409);

  const member = await prisma.locationMember.create({
    data: {
      locationId: id,
      userId: invitee.id,
      role: parsed.data.role,
    },
    select: { id: true, role: true },
  });

  return NextResponse.json({ ...member, user: invitee }, { status: 201 });
}
