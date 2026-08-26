import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationOwner } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { canChangeRole, canRemoveMember } from "@/lib/permissions";
import { memberUpdateSchema } from "@/lib/validation";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; uyeId: string }> };

async function loadTarget(locationId: string, memberId: string) {
  const [target, ownerCount] = await Promise.all([
    prisma.locationMember.findFirst({
      where: { id: memberId, locationId },
      select: { id: true, role: true, userId: true, user: { select: { name: true } } },
    }),
    prisma.locationMember.count({ where: { locationId, role: "OWNER" } }),
  ]);
  return { target, ownerCount };
}

export async function PATCH(request: Request, { params }: Params) {
  const { id, uyeId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, memberUpdateSchema);
  if ("response" in parsed) return parsed.response;

  const { target, ownerCount } = await loadTarget(id, uyeId);
  if (!target) return apiError("Üye bulunamadı", 404);

  const canChange = canChangeRole(
    access,
    { role: target.role as Role, userId: target.userId },
    parsed.data.role,
    ownerCount,
  );
  if (!canChange) return apiError("Son sahibi indiremezsin", 409);

  const updated = await prisma.locationMember.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
    select: { id: true, role: true },
  });

  await logAudit({
    locationId: id,
    userId: access.userId,
    action: "UPDATE",
    entity: "MEMBER",
    entityId: target.id,
    summary:
      `${target.user.name}: rol ${ROLE_LABELS[target.role as Role]} → ` +
      `${ROLE_LABELS[updated.role as Role]}`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, uyeId } = await params;
  const access = await requireLocationOwner(id);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const { target, ownerCount } = await loadTarget(id, uyeId);
  if (!target) return apiError("Üye bulunamadı", 404);

  if (!canRemoveMember(access, { role: target.role as Role }, ownerCount)) {
    return apiError("Son sahibi çıkaramazsın", 409);
  }

  await prisma.locationMember.delete({ where: { id: target.id } });
  await logAudit({
    locationId: id,
    userId: access.userId,
    action: "DELETE",
    entity: "MEMBER",
    entityId: target.id,
    summary: `${target.user.name} lokasyondan çıkarıldı`,
  });

  return NextResponse.json({ silindi: true });
}
