import { prisma } from "@/lib/prisma";

/**
 * Ekipmanın satıcısını çözer. Formda ya listeden seçilir ya da adı yazılır;
 * yazılan ad lokasyonun satıcıları arasında aranır, yoksa açılır.
 * Satıcı ve servis aynı tabloda (MIMARI §3).
 */
export async function resolveSeller(
  locationId: string,
  sellerId: string | undefined,
  sellerName: string | undefined,
): Promise<{ ok: true; sellerId: string | null } | { ok: false; message: string }> {
  const name = sellerName?.trim();

  if (name) {
    const existing = await prisma.vendor.findFirst({
      where: { locationId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return { ok: true, sellerId: existing.id };

    const created = await prisma.vendor.create({
      data: { locationId, name, isSeller: true },
      select: { id: true },
    });
    return { ok: true, sellerId: created.id };
  }

  if (sellerId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: sellerId, locationId },
      select: { id: true },
    });
    if (!vendor) return { ok: false, message: "Satıcı bu lokasyona ait değil" };
    return { ok: true, sellerId: vendor.id };
  }

  return { ok: true, sellerId: null };
}
