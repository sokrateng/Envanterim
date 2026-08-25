import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";
import { canEdit, canManageMembers, canView } from "@/lib/permissions";
import { currentUser } from "@/lib/session";

/**
 * Yetki her zaman lokasyon üyeliğinden geçer (CLAUDE.md). Uçlar ve sayfalar
 * veritabanına bu üç fonksiyondan başka yerden yetki sormaz.
 */

export type LocationAccess = {
  userId: string;
  locationId: string;
  role: Role;
};

export type AccessDenial = "unauthenticated" | "not-member" | "readonly";

export async function getLocationAccess(
  locationId: string,
): Promise<LocationAccess | null> {
  const user = await currentUser();
  if (!user) return null;

  const member = await prisma.locationMember.findUnique({
    where: { locationId_userId: { locationId, userId: user.id } },
    select: { role: true },
  });
  if (!member) return null;

  return { userId: user.id, locationId, role: member.role as Role };
}

/** Görüntüleme yetkisi. Üye değilse null. */
export async function requireLocation(
  locationId: string,
): Promise<LocationAccess | null> {
  const access = await getLocationAccess(locationId);
  return canView(access) ? access : null;
}

/** Ekleme/düzenleme yetkisi. Üye değilse null, yalnız görüntüleyense "readonly". */
export async function requireLocationEditor(
  locationId: string,
): Promise<LocationAccess | "readonly" | null> {
  const access = await getLocationAccess(locationId);
  if (!access) return null;
  return canEdit(access) ? access : "readonly";
}

/** Üye yönetimi yetkisi (yalnız OWNER). */
export async function requireLocationOwner(
  locationId: string,
): Promise<LocationAccess | "readonly" | null> {
  const access = await getLocationAccess(locationId);
  if (!access) return null;
  return canManageMembers(access) ? access : "readonly";
}

/** Kullanıcının üyesi olduğu lokasyonlar — listeler bunun dışına çıkmaz. */
export async function listMyLocations(userId: string) {
  const memberships = await prisma.locationMember.findMany({
    where: { userId },
    select: {
      role: true,
      location: {
        select: {
          id: true,
          name: true,
          icon: true,
          _count: { select: { items: true, members: true } },
        },
      },
    },
    orderBy: { location: { name: "asc" } },
  });

  return memberships.map((m) => ({
    ...m.location,
    role: m.role as Role,
  }));
}
