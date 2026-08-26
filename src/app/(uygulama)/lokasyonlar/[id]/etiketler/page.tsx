import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { Label } from "@/components/Label";
import { PrintButton } from "@/components/PrintButton";
import { requireLocation } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function baseUrl(): Promise<string> {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "";
}

export default async function EtiketlerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      name: true,
      items: {
        // Emekli ve satılmış ekipmana etiket basılmaz.
        where: { status: { in: ["IN_USE", "IN_REPAIR"] } },
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serialNo: true,
        },
        orderBy: { name: "asc" },
        take: 200,
      },
    },
  });
  if (!location) notFound();

  const base = await baseUrl();

  return (
    <Screen>
      <ScreenHeader
        title="QR etiketler"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
      />

      {location.items.length === 0 ? (
        <EmptyState
          title="Etiket basılacak ekipman yok"
          description="Kullanımda ya da serviste olan ekipmanlar için etiket üretilir."
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-footnote text-muted">
              {location.items.length} etiket · A4'e sığdığı kadar basılır
            </p>
            <PrintButton>Tümünü yazdır</PrintButton>
          </div>

          {/* Yazdırmada iki sütun; ekranda tek sütun okunur duruyor. */}
          <div className="grid gap-2 px-4 pt-3 print:grid-cols-2 print:gap-3 print:p-0">
            {location.items.map((item) => (
              <Label
                key={item.id}
                item={{ ...item, locationName: location.name }}
                baseUrl={base}
                size={110}
              />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
