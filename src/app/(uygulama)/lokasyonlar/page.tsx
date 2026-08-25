import { Group, Row, Rows, Screen, ScreenHeader, EmptyState, Badge } from "@/components/ui";
import { listMyLocations } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { NewLocationButton } from "./NewLocationButton";

export const metadata = { title: "Lokasyonlar — Envanterim" };
export const dynamic = "force-dynamic";

export default async function LokasyonlarPage() {
  const user = await requireUser();
  const locations = await listMyLocations(user.id);

  return (
    <Screen>
      <ScreenHeader title="Lokasyonlar" action={<NewLocationButton />} />

      {locations.length === 0 ? (
        <EmptyState
          title="Henüz lokasyon yok"
          description="Ev, iş yeri, yazlık… Ekipmanlar bir lokasyona bağlanır, paylaşım da lokasyon üzerinden olur."
        />
      ) : (
        <Group footer="Paylaşımın birimi lokasyondur: kimin ne göreceğine lokasyon üyeliği karar verir.">
          <Rows>
            {locations.map((location) => (
              <Row
                key={location.id}
                href={`/lokasyonlar/${location.id}`}
                title={`${location.icon ?? "📍"} ${location.name}`}
                subtitle={`${location._count.items} ekipman · ${location._count.members} üye`}
                badge={<Badge tone="blue">{ROLE_LABELS[location.role]}</Badge>}
              />
            ))}
          </Rows>
        </Group>
      )}
    </Screen>
  );
}
