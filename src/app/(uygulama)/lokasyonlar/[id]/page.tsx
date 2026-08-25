import { notFound } from "next/navigation";
import { Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LokasyonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocation(id);
  // Üye olmayana "yok" diyoruz: lokasyonun varlığı bile sızmasın.
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      name: true,
      icon: true,
      _count: { select: { items: true, members: true } },
    },
  });
  if (!location) notFound();

  return (
    <Screen>
      <ScreenHeader
        title={`${location.icon ?? "📍"} ${location.name}`}
        back={{ href: "/lokasyonlar", label: "Lokasyonlar" }}
      />

      <Group>
        <Rows>
          <Row
            href={`/envanter?lokasyon=${id}`}
            title="Envanter"
            subtitle="Ekipman listesi, arama ve durum filtresi"
            trailing={String(location._count.items)}
          />
          <Row
            href={`/lokasyonlar/${id}/uyeler`}
            title="Üyeler"
            subtitle="Kimin ne yetkiyle eriştiği"
            trailing={String(location._count.members)}
          />
        </Rows>
      </Group>

      <Group title="Senin rolün" footer="Rolleri yalnız lokasyon sahibi değiştirebilir.">
        <Rows>
          <Row title={ROLE_LABELS[access.role]} />
        </Rows>
      </Group>
    </Screen>
  );
}
