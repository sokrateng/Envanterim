import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

/**
 * Sistem yöneticisi denetimi. Yetki oturum belirtecinde değil **her seferinde
 * veritabanından** okunuyor: yöneticiliği alınan hesap, açık oturumuyla da
 * olsa yedek dosyalarını indirmeye devam etmesin.
 */
export async function currentAdmin() {
  const user = await currentUser();
  if (!user) return null;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, status: true },
  });
  return row?.isAdmin && row.status === "ACTIVE" ? user : null;
}

/** Sayfalarda: girişsiz /giris'e, yönetici olmayan /hesap'a gider. */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/giris");

  const admin = await currentAdmin();
  if (!admin) redirect("/hesap");
  return admin;
}
