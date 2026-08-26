import { requireLocation } from "@/lib/access";
import { NOT_MEMBER } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * Tam yedek (JSON). CSV insan içindir ve yalnız ekipman satırlarını taşır;
 * bu dosya makinenin okuyacağı hâli: olaylar, parçalar, bakım kuralları,
 * zimmet geçmişi, kategoriler ve dinamik alan tanımları.
 *
 * Dosyaların **kendisi** pakete girmiyor — fotoğraf ve fatura bir sunucusuz
 * fonksiyonun belleğine sığmaz. Onun yerine her ekin adresi listeleniyor;
 * dosyalar oradan indirilebilir. Sınır burada açıkça yazılı, çünkü "yedek
 * aldım" sanıp fotoğrafsız kalmak en kötüsü.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) return NOT_MEMBER();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      icon: true,
      createdAt: true,
      categories: {
        select: {
          id: true,
          name: true,
          icon: true,
          fields: {
            select: {
              key: true,
              label: true,
              type: true,
              order: true,
              required: true,
              options: true,
              hidden: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
      vendors: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          note: true,
          isSeller: true,
          isService: true,
        },
      },
      members: {
        select: { role: true, user: { select: { username: true, name: true } } },
      },
      items: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serialNo: true,
          place: true,
          status: true,
          currency: true,
          purchaseDate: true,
          purchasePriceMinor: true,
          warrantyEndDate: true,
          customFields: true,
          parentId: true,
          categoryId: true,
          sellerId: true,
          createdAt: true,
          events: {
            select: {
              date: true,
              kind: true,
              note: true,
              readingValue: true,
              readingUnit: true,
              costMinor: true,
              vendorId: true,
              assignedPlace: true,
              assignedToUser: { select: { username: true } },
            },
            orderBy: { date: "asc" },
          },
          parts: {
            select: {
              name: true,
              partNo: true,
              priceMinor: true,
              stock: true,
              vendorId: true,
            },
          },
          maintenance: {
            select: {
              name: true,
              everyMonths: true,
              everyReading: true,
              readingUnit: true,
              leadDays: true,
            },
          },
          assignments: {
            select: {
              assignedAt: true,
              acceptedAt: true,
              closedAt: true,
              closedReason: true,
              note: true,
              holderName: true,
              holderUser: { select: { username: true, name: true } },
              assignedBy: { select: { username: true } },
            },
            orderBy: { assignedAt: "asc" },
          },
          attachments: {
            select: {
              name: true,
              kind: true,
              mimeType: true,
              url: true,
              uploadedAt: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!location) return NOT_MEMBER();

  const dosyaSayisi = location.items.reduce(
    (toplam, item) => toplam + item.attachments.length,
    0,
  );

  const yedek = {
    bicim: "envanterim-yedek",
    surum: 1,
    alindi: new Date().toISOString(),
    not:
      "Fotoğraf ve belgelerin kendisi bu dosyada değil; her ekin adresi " +
      "items[].attachments[].url alanında. Dosyaları ayrıca indir.",
    dosyaSayisi,
    lokasyon: location,
  };

  const adSlug = location.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
  const tarih = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(yedek, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="envanterim-${adSlug}-${tarih}.json"`,
      // Yedek her zaman tazedir; ara katman saklamasın.
      "cache-control": "no-store",
    },
  });
}
