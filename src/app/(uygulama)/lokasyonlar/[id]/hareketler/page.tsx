import { notFound } from "next/navigation";
import { EmptyState, Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { getLocationAccess } from "@/lib/access";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  type AuditAction,
  type AuditEntity,
} from "@/lib/audit";
import { canManageMembers } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Hareketler — Envanterim" };
export const dynamic = "force-dynamic";

const trTarih = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Denetim izi. Silinen kayıt geri gelmiyor ama izi duruyor: paylaşılan bir
 * envanterde "bu nereye gitti" sorusunun tek cevabı bu.
 *
 * Yalnız sahip görüyor — kimin ne sildiği, üyelik yönetimi kadar hassas.
 */
export default async function HareketlerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getLocationAccess(id);
  if (!access || !canManageMembers(access)) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!location) notFound();

  const rows = await prisma.auditLog.findMany({
    where: { locationId: id },
    select: {
      id: true,
      action: true,
      entity: true,
      summary: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <Screen>
      <ScreenHeader
        title="Hareketler"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
      />

      <Group footer="Son 100 hareket. Zimmet geçmişi ekipmanın zaman çizelgesinde ayrıca duruyor.">
        {rows.length ? (
          <Rows>
            {rows.map((row) => (
              <Row
                key={row.id}
                title={row.summary}
                subtitle={`${row.user?.name ?? "Silinmiş kullanıcı"} · ${trTarih.format(row.createdAt)}`}
                trailing={
                  `${AUDIT_ENTITY_LABELS[row.entity as AuditEntity] ?? row.entity} ` +
                  `${AUDIT_ACTION_LABELS[row.action as AuditAction] ?? ""}`
                }
              />
            ))}
          </Rows>
        ) : (
          <EmptyState
            title="Hareket yok"
            description="Silme ve yetki değişiklikleri burada birikir."
          />
        )}
      </Group>
    </Screen>
  );
}
