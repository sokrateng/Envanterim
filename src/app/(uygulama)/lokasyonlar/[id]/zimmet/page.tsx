import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import {
  activeAssignment,
  assignmentState,
  holderView,
  isOverdue,
  pendingDays,
} from "@/lib/assignment";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Zimmet — Envanterim" };
export const dynamic = "force-dynamic";

/**
 * Zimmet raporu. Asıl sorusu "kim üzerine almadı": teslim–tesellümde değeri
 * olan şey atama değil, karşı tarafın onayı.
 */
export default async function ZimmetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: { id: true, name: true, icon: true },
  });
  if (!location) notFound();

  const items = await prisma.item.findMany({
    where: { locationId: id, status: { in: ["IN_USE", "IN_REPAIR"] } },
    select: {
      id: true,
      name: true,
      assignments: {
        where: { closedAt: null },
        select: {
          id: true,
          holderUserId: true,
          holderName: true,
          assignedAt: true,
          acceptedAt: true,
          closedAt: true,
          closedReason: true,
          holderUser: { select: { name: true } },
          assignedBy: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const bekleyen: Array<{
    itemId: string;
    itemName: string;
    holder: string;
    days: number;
    overdue: boolean;
    assignedBy: string;
  }> = [];
  const uzerinde = new Map<string, string[]>();
  let zimmetsiz = 0;

  for (const item of items) {
    const active = activeAssignment(item.assignments);
    if (!active) {
      zimmetsiz += 1;
      continue;
    }

    const holder = holderView(active, active.holderUser?.name).name;
    if (assignmentState(active) === "PENDING") {
      bekleyen.push({
        itemId: item.id,
        itemName: item.name,
        holder,
        days: pendingDays(active),
        overdue: isOverdue(active),
        assignedBy: active.assignedBy.name,
      });
    } else {
      const list = uzerinde.get(holder) ?? [];
      list.push(item.name);
      uzerinde.set(holder, list);
    }
  }

  // Uzun bekleyen üste: raporun işi zaten gecikeni göstermek.
  bekleyen.sort((a, b) => b.days - a.days);
  const kisiler = [...uzerinde.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));

  return (
    <Screen>
      <ScreenHeader
        title="Zimmet"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
      />

      <Group
        title="Teslim bekleyenler"
        footer="Atandı ama karşı taraf üzerine almadı. Üç günü geçenler kırmızı."
      >
        {bekleyen.length ? (
          <Rows>
            {bekleyen.map((row) => (
              <Row
                key={row.itemId}
                href={`/envanter/${row.itemId}`}
                title={row.itemName}
                subtitle={`${row.holder} · ${row.assignedBy} verdi`}
                trailing={
                  <Badge tone={row.overdue ? "red" : "orange"}>
                    {row.days === 0 ? "bugün" : `${row.days} gün`}
                  </Badge>
                }
              />
            ))}
          </Rows>
        ) : (
          <EmptyState
            title="Bekleyen yok"
            description="Zimmetlenen her ekipman teslim alınmış."
          />
        )}
      </Group>

      <Group title="Kimde ne var" footer={`${zimmetsiz} ekipman zimmetsiz.`}>
        {kisiler.length ? (
          <Rows>
            {kisiler.map(([holder, names]) => (
              <Row
                key={holder}
                title={holder}
                subtitle={names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "")}
                trailing={String(names.length)}
              />
            ))}
          </Rows>
        ) : (
          <EmptyState
            title="Zimmet yok"
            description="Ekipman sayfasından “Zimmet ver” ile başlayabilirsin."
          />
        )}
      </Group>

      <p className="px-8 pt-2 text-footnote text-muted">
        Pasif ve satılmış ekipmanlar bu raporda yok.{" "}
        <Link href={`/envanter?lokasyon=${id}`} className="text-blue">
          Envanterin tamamı
        </Link>
      </p>
    </Screen>
  );
}
