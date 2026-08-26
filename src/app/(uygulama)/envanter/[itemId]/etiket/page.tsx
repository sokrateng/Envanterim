import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Screen, ScreenHeader } from "@/components/ui";
import { Label } from "@/components/Label";
import { PrintButton } from "@/components/PrintButton";
import { requireLocation } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Etiketteki adres: dağıtımda NEXTAUTH_URL, yerelde isteğin kendi kökü. */
async function baseUrl(): Promise<string> {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "";
}

export default async function EtiketPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      brand: true,
      model: true,
      serialNo: true,
      locationId: true,
      location: { select: { name: true } },
    },
  });
  if (!item) notFound();

  const access = await requireLocation(item.locationId);
  if (!access) notFound();

  return (
    <Screen>
      <ScreenHeader
        title="QR etiket"
        back={{ href: `/envanter/${item.id}`, label: "Ekipman" }}
      />
      <p className="px-4 pt-2 text-footnote text-muted">
        Etiketi yazdırıp cihazın üstüne yapıştır. Telefonla okutunca bu ürünün
        sayfası açılır — seri no aramaya gerek kalmaz.
      </p>

      <div className="px-4 pt-4 print:p-0">
        <Label
          item={{ ...item, locationName: item.location.name }}
          baseUrl={await baseUrl()}
          size={140}
        />
      </div>

      <div className="px-4 pt-4">
        <PrintButton />
      </div>
    </Screen>
  );
}
