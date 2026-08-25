import type { Role } from "@/lib/constants";

/**
 * Saf yetki kuralları — veritabanına dokunmaz.
 * Yetki her zaman lokasyon üyeliğinden geçer, kullanıcı kimliğinden değil
 * (CLAUDE.md). Veritabanına dokunan sarmalayıcılar src/lib/access.ts'te.
 */

export type Membership = { role: Role } | null | undefined;

export function canView(member: Membership): boolean {
  return member != null;
}

export function canEdit(member: Membership): boolean {
  return member?.role === "OWNER" || member?.role === "EDITOR";
}

export function canManageMembers(member: Membership): boolean {
  return member?.role === "OWNER";
}

export function canManageCategories(member: Membership): boolean {
  return member?.role === "OWNER";
}

/** Son sahibi indirmek lokasyonu sahipsiz bırakır. */
export function canChangeRole(
  actor: Membership,
  target: { role: Role; userId: string },
  newRole: Role,
  ownerCount: number,
): boolean {
  if (!canManageMembers(actor)) return false;
  if (target.role === "OWNER" && newRole !== "OWNER" && ownerCount <= 1) {
    return false;
  }
  return true;
}

export function canRemoveMember(
  actor: Membership,
  target: { role: Role },
  ownerCount: number,
): boolean {
  if (!canManageMembers(actor)) return false;
  if (target.role === "OWNER" && ownerCount <= 1) return false;
  return true;
}
