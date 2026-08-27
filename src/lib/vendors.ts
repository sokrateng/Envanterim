import { prisma } from "@/lib/prisma";

/**
 * Firmalar: satıcı ve yetkili servis.
 *
 * İkisi ayrı işler — aldığın yerle tamir ettiğin yer çoğu zaman aynı değil —
 * ama aynı tablodalar: bir firma ikisini birden yapabiliyor (Teknosa hem
 * satıyor hem servis veriyor). Bu yüzden ayrı tablo değil, iki rol bayrağı;
 * listeler role göre süzülüyor, kimse satıcı kutusunda servis firması
 * görmüyor.
 *
 * Firma **lokasyona bağlı değil**: aynı bayiyi her lokasyon için yeniden
 * yazmak angarya. Kayıt yine bir lokasyona çapalı duruyor, çünkü bu
 * uygulamada yetki lokasyon üyeliğinden geçiyor (CLAUDE.md) — firmanın
 * sahibi yok, üyeliği olan görüyor. Seçim ve arama, kullanıcının üyesi
 * olduğu **bütün** lokasyonların firmalarında yapılıyor.
 */

export type VendorRole = "seller" | "service";

export type VendorOption = { id: string; name: string };

export type VendorResult =
  | { ok: true; vendorId: string | null }
  | { ok: false; message: string };

const ROLE_FIELD: Record<VendorRole, "isSeller" | "isService"> = {
  seller: "isSeller",
  service: "isService",
};

const ROLE_TEXT: Record<VendorRole, string> = {
  seller: "Satıcı",
  service: "Yetkili servis",
};

/** Kullanıcının firmalarını gördüğü lokasyonlar. */
async function myLocationIds(userId: string): Promise<string[]> {
  const memberships = await prisma.locationMember.findMany({
    where: { userId },
    select: { locationId: true },
  });
  return memberships.map((m) => m.locationId);
}

/** Seçim listeleri: rolüne göre süzülmüş, kullanıcının bütün lokasyonlarından. */
export async function listVendors(
  userId: string,
  role: VendorRole,
): Promise<VendorOption[]> {
  const locationIds = await myLocationIds(userId);
  if (!locationIds.length) return [];

  return prisma.vendor.findMany({
    where: { locationId: { in: locationIds }, [ROLE_FIELD[role]]: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Hem satıcı hem servis listesi tek turda: ekipman sayfası ikisini de istiyor. */
export async function listVendorsByRole(
  userId: string,
): Promise<{ sellers: VendorOption[]; services: VendorOption[] }> {
  const locationIds = await myLocationIds(userId);
  if (!locationIds.length) return { sellers: [], services: [] };

  const vendors = await prisma.vendor.findMany({
    where: { locationId: { in: locationIds } },
    select: { id: true, name: true, isSeller: true, isService: true },
    orderBy: { name: "asc" },
  });

  return {
    sellers: vendors.filter((v) => v.isSeller).map(({ id, name }) => ({ id, name })),
    services: vendors
      .filter((v) => v.isService)
      .map(({ id, name }) => ({ id, name })),
  };
}

/**
 * Formdaki firmayı çözer: ya listeden seçilir ya adı yazılır.
 *
 * Yazılan ad kullanıcının bütün lokasyonlarında aranıyor (büyük/küçük harf
 * duyarsız); bulunursa aynı kayıt kullanılıyor ve gerekiyorsa yeni rolü
 * kazanıyor — "Teknosa"dan alıp yine "Teknosa"ya servise götüren kullanıcı
 * ikinci bir kayıt açmasın diye.
 */
export async function resolveVendor({
  userId,
  locationId,
  vendorId,
  vendorName,
  role,
}: {
  userId: string;
  /** Yeni kayıt buraya çapalanıyor: yetki lokasyon üyeliğinden geçiyor. */
  locationId: string;
  vendorId?: string;
  vendorName?: string;
  role: VendorRole;
}): Promise<VendorResult> {
  const name = vendorName?.trim();
  const field = ROLE_FIELD[role];

  if (name) {
    const locationIds = await myLocationIds(userId);
    const existing = await prisma.vendor.findFirst({
      where: {
        locationId: { in: locationIds },
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true, isSeller: true, isService: true },
    });

    if (existing) {
      if (!existing[field]) {
        await prisma.vendor.update({
          where: { id: existing.id },
          data: { [field]: true },
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
    const locationIds = await myLocationIds(userId);
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, locationId: { in: locationIds } },
      select: { id: true },
    });
    if (!vendor) {
      return { ok: false, message: `${ROLE_TEXT[role]} listende yok` };
    }
    return { ok: true, vendorId: vendor.id };
  }

  return { ok: true, vendorId: null };
}

/** Ekipmanın satıcısı — `resolveVendor`'ın satın alma tarafındaki adı. */
export async function resolveSeller(args: {
  userId: string;
  locationId: string;
  sellerId?: string;
  sellerName?: string;
}): Promise<
  { ok: true; sellerId: string | null } | { ok: false; message: string }
> {
  const result = await resolveVendor({
    userId: args.userId,
    locationId: args.locationId,
    vendorId: args.sellerId,
    vendorName: args.sellerName,
    role: "seller",
  });
  if (!result.ok) return result;
  return { ok: true, sellerId: result.vendorId };
}
