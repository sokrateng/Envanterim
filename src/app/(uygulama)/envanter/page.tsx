import Link from "next/link";
import { Badge, EmptyState, Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { listMyLocations } from "@/lib/access";
import {
  ITEM_STATUS,
  ITEM_STATUS_LABELS,
  type FieldType,
  type ItemStatus,
} from "@/lib/constants";
import type { CategoryOption } from "@/components/ItemFields";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { warrantyStatus } from "@/lib/warranty";
import {
  activeAssignment,
  assignmentState,
  holderSummary,
  isOverdue,
} from "@/lib/assignment";
import { ItemSwipe } from "./ItemSwipe";
import { NewItemButton } from "./NewItemButton";
import { SearchField } from "./SearchField";
import { StatusFilter } from "./StatusFilter";

export const metadata = { title: "Envanter — Envanterim" };
export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  durum?: string;
  lokasyon?: string;
  kategori?: string;
  zimmet?: string;
};

const ZIMMET_FILTERS = ["bende", "bekleyen", "zimmetsiz"] as const;
type ZimmetFilter = (typeof ZIMMET_FILTERS)[number];

const ZIMMET_LABELS: Record<ZimmetFilter, string> = {
  bende: "Bende",
  bekleyen: "Teslim bekleyen",
  zimmetsiz: "Zimmetsiz",
};

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

  const assignmentFilter = ZIMMET_FILTERS.includes(filters.zimmet as ZimmetFilter)
    ? (filters.zimmet as ZimmetFilter)
    : null;

  const query = (filters.q ?? "").trim();
  const requestedCategory = filters.kategori ?? null;

  // Kategoriler lokasyona ait; forma yalnız üye olunan lokasyonlarınki gider.
  const categories = memberLocationIds.length
    ? await prisma.category.findMany({
        where: { locationId: { in: memberLocationIds } },
        select: {
          id: true,
          name: true,
          icon: true,
          locationId: true,
          fields: {
            select: {
              key: true,
              label: true,
              type: true,
              required: true,
              options: true,
              hidden: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const categoriesByLocation: Record<string, CategoryOption[]> = {};
  for (const category of categories) {
    const option: CategoryOption = {
      id: category.id,
      name: category.name,
      icon: category.icon,
      fields: category.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type as FieldType,
        required: field.required,
        options: Array.isArray(field.options) ? (field.options as string[]) : null,
        hidden: field.hidden,
      })),
    };
    (categoriesByLocation[category.locationId] ??= []).push(option);
  }

  // Filtre çubuğu yalnız seçili lokasyonun (ya da hepsinin) kategorilerini
  // gösterir; başka lokasyonun kategorisiyle filtrelemek anlamsız olurdu.
  const filterCategories = selectedLocation
    ? (categoriesByLocation[selectedLocation] ?? [])
    : categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, fields: [] }));

  // Başka lokasyonun kategorisiyle filtrelenmesin: gelen parametre üye
  // olunan lokasyonların kategorileriyle kesiştirilir.
  const categoryFilter =
    requestedCategory && categories.some((c) => c.id === requestedCategory)
      ? requestedCategory
      : null;

  const items = memberLocationIds.length
    ? await prisma.item.findMany({
        where: {
          locationId: selectedLocation
            ? selectedLocation
            : { in: memberLocationIds },
          ...(status ? { status } : {}),
          ...(categoryFilter ? { categoryId: categoryFilter } : {}),
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
          category: { select: { name: true, icon: true } },
          parentId: true,
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
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 200,
      })
    : [];

  // Zimmet durumu kayıttan türetiliyor, sütun değil: süzme burada yapılıyor.
  const withHolder = items.map((item) => {
    const active = activeAssignment(item.assignments);
    return {
      ...item,
      active,
      holder: holderSummary(active, active?.holderUser?.name),
      pending: active ? assignmentState(active) === "PENDING" : false,
      overdue: active ? isOverdue(active) : false,
    };
  });

  const hasAssignments = withHolder.some((item) => item.active);

  const visible = withHolder.filter((item) => {
    if (!assignmentFilter) return true;
    if (assignmentFilter === "zimmetsiz") return !item.active;
    if (assignmentFilter === "bekleyen") return item.pending;
    return item.active?.holderUserId === user.id;
  });

  const vendors = memberLocationIds.length
    ? await prisma.vendor.findMany({
        where: { locationId: { in: memberLocationIds }, isSeller: true },
        select: { id: true, name: true, locationId: true },
        orderBy: { name: "asc" },
      })
    : [];

  const vendorsByLocation: Record<string, Array<{ id: string; name: string }>> = {};
  for (const vendor of vendors) {
    (vendorsByLocation[vendor.locationId] ??= []).push({
      id: vendor.id,
      name: vendor.name,
    });
  }

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
              categoriesByLocation={categoriesByLocation}
              vendorsByLocation={vendorsByLocation}
            />
          ) : undefined
        }
      />

      <div className="flex items-center gap-2 px-4 pt-3">
        <SearchField defaultValue={query} />
        <Link
          href="/tara"
          aria-label="Kod tara"
          className="grid h-touch w-touch shrink-0 place-items-center rounded-card border border-separator bg-surface text-blue active:opacity-60"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15M7.5 12h9" />
          </svg>
        </Link>
      </div>
      <div className="px-4 pt-3">
        <StatusFilter value={status} />
      </div>

      {locations.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          <Chip
            href={buildHref({ ...filters, lokasyon: undefined })}
            label="Tüm lokasyonlar"
            active={!selectedLocation}
          />
          {locations.map((location) => (
            <Chip
              key={location.id}
              href={buildHref({ ...filters, lokasyon: location.id })}
              label={`${location.icon ?? "📍"} ${location.name}`}
              active={selectedLocation === location.id}
            />
          ))}
        </div>
      ) : null}

      {filterCategories.length ? (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          <Chip
            href={buildHref({ ...filters, kategori: undefined })}
            label="Tüm kategoriler"
            active={!categoryFilter}
          />
          {filterCategories.map((category) => (
            <Chip
              key={category.id}
              href={buildHref({ ...filters, kategori: category.id })}
              label={`${category.icon ?? "🏷"} ${category.name}`}
              active={categoryFilter === category.id}
            />
          ))}
        </div>
      ) : null}

      {/* Zimmet çubuğu ancak kullanılıyorsa çıkıyor: 390 pikselde üçüncü çip
          sırası listeyi ekranın dışına itiyor. */}
      {hasAssignments || assignmentFilter ? (
      <div className="flex gap-2 overflow-x-auto px-4 pt-3">
        <Chip
          href={buildHref({ ...filters, zimmet: undefined })}
          label="Tüm zimmetler"
          active={!assignmentFilter}
        />
        {ZIMMET_FILTERS.map((option) => (
          <Chip
            key={option}
            href={buildHref({ ...filters, zimmet: option })}
            label={ZIMMET_LABELS[option]}
            active={assignmentFilter === option}
          />
        ))}
      </div>
      ) : null}

      {locations.length === 0 ? (
        <EmptyState
          title="Önce bir lokasyon aç"
          description="Ekipman bir lokasyona bağlanır. Lokasyonlar sekmesinden başla."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Ekipman yok"
          description={
            query || status
              ? "Bu filtreyle eşleşen ekipman bulunamadı."
              : "Sağ üstteki + ile ilk ekipmanını ekle."
          }
        />
      ) : (
        <Group title={`${visible.length} ekipman`}>
          <Rows>
            {visible.map((item) => {
              const warranty = warrantyStatus(item.warrantyEndDate);
              const details = [
                item.active ? item.holder : null,
                [item.brand, item.model].filter(Boolean).join(" "),
                item.category?.name ?? null,
                item.serialNo ? `SN ${item.serialNo}` : null,
                selectedLocation ? null : item.location.name,
              ]
                .filter(Boolean)
                .join(" · ");

              const pendingForMe =
                item.pending && item.active?.holderUserId === user.id
                  ? (item.active?.id ?? null)
                  : null;

              return (
                <ItemSwipe
                  key={item.id}
                  itemId={item.id}
                  name={item.name}
                  pendingAssignmentId={pendingForMe}
                  status={item.status}
                  editable={editableLocations.some((l) => l.id === item.location.id)}
                >
                <Row
                  badgesBelow
                  href={`/envanter/${item.id}`}
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
                </ItemSwipe>
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
  if (params.kategori) query.set("kategori", params.kategori);
  if (params.zimmet) query.set("zimmet", params.zimmet);
  const text = query.toString();
  return text ? `/envanter?${text}` : "/envanter";
}

function Chip({
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
