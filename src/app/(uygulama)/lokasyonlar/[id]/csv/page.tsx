import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import { CSV_COLUMNS } from "@/lib/item-csv";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CsvTools } from "./CsvTools";

export const dynamic = "force-dynamic";

export default async function CsvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: { name: true, _count: { select: { items: true } } },
  });
  if (!location) notFound();

  return (
    <Screen>
      <ScreenHeader
        title="CSV"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
      />
      <CsvTools
        locationId={id}
        itemCount={location._count.items}
        canImport={canEdit(access)}
        columns={[...CSV_COLUMNS]}
      />
    </Screen>
  );
}
