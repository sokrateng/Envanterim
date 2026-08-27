import { Screen, ScreenHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Vendors, type VendorRow } from "./Vendors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Firmalar — Envanterim" };

/**
 * Satıcı ve yetkili servis firmaları.
 *
 * Lokasyonun altında değil hesabın altında: firma lokasyona ait değil, kişiye
 * ait bir defter. Aynı bayi her lokasyon için yeniden yazılmıyor.
 */
export default async function FirmalarPage() {
  const user = await requireUser();

  const memberships = await prisma.locationMember.findMany({
    where: { userId: user.id },
    select: { locationId: true },
  });
  const locationIds = memberships.map((m) => m.locationId);

  const vendors = locationIds.length
    ? await prisma.vendor.findMany({
        where: { locationId: { in: locationIds } },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          website: true,
          address: true,
          note: true,
          isSeller: true,
          isService: true,
          // Kullanım sayısı silmenin önünü kesiyor: silinen firmanın kimliği
          // ekipmanda null'a düşerdi, kullanıcı bunu beklemiyor.
          _count: {
            select: {
              soldItems: true,
              serviceJobs: true,
              parts: true,
              events: true,
            },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const rows: VendorRow[] = vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    phone: vendor.phone,
    email: vendor.email,
    website: vendor.website,
    address: vendor.address,
    note: vendor.note,
    isSeller: vendor.isSeller,
    isService: vendor.isService,
    usage:
      vendor._count.soldItems +
      vendor._count.serviceJobs +
      vendor._count.parts +
      vendor._count.events,
  }));

  return (
    <Screen>
      <ScreenHeader title="Firmalar" back={{ href: "/hesap", label: "Hesap" }} />
      <Vendors vendors={rows} />
    </Screen>
  );
}
