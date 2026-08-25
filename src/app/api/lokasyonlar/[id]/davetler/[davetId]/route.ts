import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError } from "@/lib/api";

/** Kullanılmamış daveti iptal eder. Kullanılmış davet kaydı silinmez: kimin
 *  hangi kodla geldiği izini kaybetmeyelim. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; davetId: string }> },
) {
  const { id, davetId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const invite = await prisma.locationInvite.findFirst({
    where: { id: davetId, locationId: id },
    select: { id: true, usedAt: true },
  });
  if (!invite) return apiError("Davet bulunamadı", 404);
  if (invite.usedAt) return apiError("Kullanılmış davet silinemez", 409);

  await prisma.locationInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ silindi: true });
}
