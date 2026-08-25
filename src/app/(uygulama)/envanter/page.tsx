import Link from "next/link";
import { Badge, EmptyState, Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { listMyLocations } from "@/lib/access";
import { ITEM_STATUS, ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { warrantyStatus } from "@/lib/warranty";
import { NewItemButton } from "./NewItemButton";
import { SearchField } from "./SearchField";
import { StatusFilter } from "./StatusFilter";

export const metadata = { title: "Envanter — Envanterim" };
export const dynamic = "force-dynamic";

type Search = { q?: string; durum?: string; lokasyon?: string };

export default async function EnvanterPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const filters = await searchParams;
  const user = await requireUser();
  const locations = await listMyLocations(user.id);

  // İstemciye giden veri zaten filtrelenmiş olmalı: sorgu yalnız üye olunan
  // lokasyonlara bakar, gelen lokasyon parametresi bu kümeyle kesiştirilir.
  const memberLocationIds = locations.map((l) => l.id);
  const selectedLocation =
    filters.lokasyon && memberLocationIds.includes(filters.lokasyon)
      ? filters.lokasyon
      : null;

  const status = ITEM_STATUS.includes(filters.durum as ItemStatus)
    ? (filters.durum as ItemStatus)
    : null;

  const query = (filters.q ?? "").trim();

  const items = memberLocationIds.length
    ? await prisma.item.findMany({
        where: {
          locationId: selectedLocation
            ? selectedLocation
            : { in: memberLocationIds },
          ...(status ? { status } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { brand: { contains: query, mode: "insensitive" as const } },
                  { model: { contains: query, mode: "insensitive" as const } },
                  { serialNo: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serialNo: true,
          status: true,
          warrantyEndDate: true,
          purchasePriceMinor: true,
          currency: true,
          location: { select: { id: true, name: true, icon: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 200,
      })
    : [];

  const editableLocations = locations.filter(
    (l) => l.role === "OWNER" || l.role === "EDITOR",
  );

  return (
    <Screen>
      <ScreenHeader
        title="Envanter"
        action={
          editableLocations.length ? (
            <NewItemButton
              locations={editableLocations.map((l) => ({
                id: l.id,
                name: l.name,
              }))}
              defaultLocationId={selectedLocation ?? editableLocations[0].id}
            />
          ) : undefined
        }
      />

      <div className="px-4 pt-3">
        <SearchField defaultValue={query} />
      </div>
      <div className="px-4 pt-3">
        <StatusFilter value={status} />
      </div>

      {locations.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          <LocationChip
            href={buildHref({ ...filters, lokasyon: undefined })}
            label="Tüm lokasyonlar"
            active={!selectedLocation}
          />
          {locations.map((location) => (
            <LocationChip
              key={location.id}
              href={buildHref({ ...filters, lokasyon: location.id })}
              label={`${location.icon ?? "📍"} ${location.name}`}
              active={selectedLocation === location.id}
            />
          ))}
        </div>
      ) : null}

      {locations.length === 0 ? (
        <EmptyState
          title="Önce bir lokasyon aç"
          description="Ekipman bir lokasyona bağlanır. Lokasyonlar sekmesinden başla."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Ekipman yok"
          description={
            query || status
              ? "Bu filtreyle eşleşen ekipman bulunamadı."
              : "Sağ üstteki + ile ilk ekipmanını ekle."
          }
        />
      ) : (
        <Group title={`${items.length} ekipman`}>
          <Rows>
            {items.map((item) => {
              const warranty = warrantyStatus(item.warrantyEndDate);
              const details = [
                [item.brand, item.model].filter(Boolean).join(" "),
                item.serialNo ? `SN ${item.serialNo}` : null,
                selectedLocation ? null : item.location.name,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <Row
                  key={item.id}
                  badgesBelow
                  title={item.name}
                  subtitle={details || "Ayrıntı girilmemiş"}
                  badge={
                    <>
                      {item.status !== "IN_USE" ? (
                        <Badge tone={item.status === "IN_REPAIR" ? "orange" : "muted"}>
                          {ITEM_STATUS_LABELS[item.status as ItemStatus]}
                        </Badge>
                      ) : null}
                      <Badge
                        tone={
                          warranty.state === "active"
                            ? "green"
                            : warranty.state === "ending-soon"
                              ? "orange"
                              : "muted"
                        }
                      >
                        {warranty.label}
                      </Badge>
                    </>
                  }
                  trailing={
                    item.purchasePriceMinor != null
                      ? formatMoney(item.purchasePriceMinor, item.currency)
                      : undefined
                  }
                />
              );
            })}
          </Rows>
        </Group>
      )}
    </Screen>
  );
}

function buildHref(params: Search) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.durum) query.set("durum", params.durum);
  if (params.lokasyon) query.set("lokasyon", params.lokasyon);
  const text = query.toString();
  return text ? `/envanter?${text}` : "/envanter";
}

function LocationChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`min-h-touch shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-subheadline active:opacity-60 ${
        active ? "bg-blue text-white" : "bg-surface text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
