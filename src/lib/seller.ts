import { prisma } from "@/lib/prisma";

export type VendorResult =
  | { ok: true; vendorId: string | null }
  | { ok: false; message: string };

/**
 * Firmayı çözer: formda ya listeden seçilir ya da adı yazılır; yazılan ad
 * lokasyonun firmaları arasında aranır (büyük/küçük harf duyarsız), yoksa
 * açılır. Satıcı ve servis aynı tabloda — çoğu yerde ikisi de aynı firma
 * (MIMARI §3); hangi rolde kullanıldığı bayrakla işaretleniyor.
 */
export async function resolveVendor(
  locationId: string,
  vendorId: string | undefined,
  vendorName: string | undefined,
  role: "seller" | "service",
): Promise<VendorResult> {
  const name = vendorName?.trim();

  if (name) {
    const existing = await prisma.vendor.findFirst({
      where: { locationId, name: { equals: name, mode: "insensitive" } },
      select: { id: true, isSeller: true, isService: true },
    });

    if (existing) {
      // Satıcı olarak tanınan firma servise de gidiyorsa ikinci bayrak açılır.
      const needsSeller = role === "seller" && !existing.isSeller;
      const needsService = role === "service" && !existing.isService;
      if (needsSeller || needsService) {
        await prisma.vendor.update({
          where: { id: existing.id },
          data: { isSeller: existing.isSeller || needsSeller, isService: existing.isService || needsService },
        });
      }
      return { ok: true, vendorId: existing.id };
    }

    const created = await prisma.vendor.create({
      data: {
        locationId,
        name,
        isSeller: role === "seller",
        isService: role === "service",
      },
      select: { id: true },
    });
    return { ok: true, vendorId: created.id };
  }

  if (vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, locationId },
      select: { id: true },
    });
    if (!vendor) return { ok: false, message: "Firma bu lokasyona ait değil" };
    return { ok: true, vendorId: vendor.id };
  }

  return { ok: true, vendorId: null };
}

/** Ekipmanın satıcısı — `resolveVendor`'ın satın alma tarafındaki adı. */
export async function resolveSeller(
  locationId: string,
  sellerId: string | undefined,
  sellerName: string | undefined,
): Promise<{ ok: true; sellerId: string | null } | { ok: false; message: string }> {
  const result = await resolveVendor(locationId, sellerId, sellerName, "seller");
  if (!result.ok) return { ok: false, message: "Satıcı bu lokasyona ait değil" };
  return { ok: true, sellerId: result.vendorId };
}
