import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { generateInviteCode, inviteExpiry } from "@/lib/invite";
import { inviteCreateSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, inviteCreateSchema);
  if ("response" in parsed) return parsed.response;

  // Kod benzersiz olana kadar dene: çarpışma olasılığı çok düşük ama
  // benzersizlik kısıtı veritabanında, sessizce 500 dönmesin.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const existing = await prisma.locationInvite.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) continue;

    const invite = await prisma.locationInvite.create({
      data: {
        code,
        locationId: id,
        role: parsed.data.role,
        createdById: access.userId,
        expiresAt: inviteExpiry(),
      },
      select: { id: true, code: true, role: true, expiresAt: true },
    });
    return NextResponse.json(invite, { status: 201 });
  }

  return apiError("Kod üretilemedi, tekrar dene", 500);
}
