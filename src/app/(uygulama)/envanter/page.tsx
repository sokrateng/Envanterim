import Link from "next/link";
import {
  Badge,
  EmptyState,
  Group,
  Row,
  Rows,
  Screen,
  ScreenHeader,
} from "@/components/ui";
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
import { ItemPhoto } from "./ItemPhoto";
import { ItemSwipe } from "./ItemSwipe";
import { isExtractionConfigured } from "@/lib/invoice-extract";
import { NewItemButton } from "./NewItemButton";
import { SearchField } from "./SearchField";
import { Filters, type FilterGroup } from "./Filters";

export const metadata = { title: "Envanter — Envanterim" };
export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  durum?: string;
  lokasyon?: string;
  kategori?: string;
  zimmet?: string;
  sayfa?: string;
};

/** Bir sayfada kaç ekipman. iPhone'da 50 satır kaydırmakla bitiyor. */
const PAGE_SIZE = 50;

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

  const assignmentFilter = ZIMMET_FILTERS.includes(
    filters.zimmet as ZimmetFilter,
  )
    ? (filters.zimmet as ZimmetFilter)
    : null;

  const query = (filters.q ?? "").trim();
  const requestedCategory = filters.kategori ?? null;

  // Kategoriler lokasyona ait; forma yalnız üye olunan lokasyonlarınki gider.
  const categoriesPromise = memberLocationIds.length
    ? prisma.category.findMany({
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
    : Promise.resolve([]);

  // Süzme veritabanında yapılıyor: sayfa sınırından sonra elemek listeyi
  // sessizce eksiltir — kullanıcı eksik listeye baktığını anlamaz.
  const where = {
    locationId: selectedLocation ? selectedLocation : { in: memberLocationIds },
    ...(status ? { status } : {}),
    // Kategori kimliği doğrudan kullanılıyor: satırlar zaten üye olunan
    // lokasyonlarla sınırlı, başka lokasyonun kategorisi eşleşemez. Böylece
    // liste sorgusu kategori listesini beklemiyor.
    ...(requestedCategory ? { categoryId: requestedCategory } : {}),
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
    // Zimmet durumu sütun değil, kapanmamış kayıt: koşul ilişkiye kuruluyor.
    ...(assignmentFilter === "zimmetsiz"
      ? { assignments: { none: { closedAt: null } } }
      : {}),
    ...(assignmentFilter === "bekleyen"
      ? { assignments: { some: { closedAt: null, acceptedAt: null } } }
      : {}),
    ...(assignmentFilter === "bende"
      ? { assignments: { some: { closedAt: null, holderUserId: user.id } } }
      : {}),
  };

  const page = Math.max(1, Number(filters.sayfa) || 1);

  // Sayım ve liste tek işlemde gidiyor: ayrı ayrı beklemek uzak bölgedeki
  // veritabanında iki tur demek.
  const listeIstegi = memberLocationIds.length
    ? prisma.$transaction([
        prisma.item.count({ where }),
        prisma.item.findMany({
          where,
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
            // Listedeki küçük görsel: ilk fotoğraf yeter, tümünü çekmiyoruz.
            attachments: {
              where: { kind: "PHOTO" },
              select: { url: true },
              orderBy: { uploadedAt: "asc" },
              take: 1,
            },
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
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ])
    : Promise.resolve([0, []] as const);

  // Birbirine bağlı olmayan sorgular birlikte gidiyor: sırayla beklemek
  // uzak bölgedeki veritabanında her biri için ayrı bir tur demek.
  const [[total, items], categories, acikZimmet, vendors] = await Promise.all([
    listeIstegi,
    categoriesPromise,
    // Zimmet çubuğu ancak özellik kullanılıyorsa çıksın; sayfadaki
    // satırlara bakmak yetmiyor, ikinci sayfada zimmet olabilir.
    memberLocationIds.length
      ? prisma.itemAssignment.count({
          where: {
            closedAt: null,
            item: { locationId: { in: memberLocationIds } },
          },
          take: 1,
        })
      : Promise.resolve(0),
    memberLocationIds.length
      ? prisma.vendor.findMany({
          where: { locationId: { in: memberLocationIds }, isSeller: true },
          select: { id: true, name: true, locationId: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const hasAssignments = acikZimmet > 0;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Görünen satırın sorumlusu: durum kayıttan türetiliyor, saklanmıyor.
  const visible = items.map((item) => {
    const active = activeAssignment(item.assignments);
    return {
      ...item,
      active,
      holder: holderSummary(active, active?.holderUser?.name),
      pending: active ? assignmentState(active) === "PENDING" : false,
      overdue: active ? isOverdue(active) : false,
    };
  });

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
        options: Array.isArray(field.options)
          ? (field.options as string[])
          : null,
        hidden: field.hidden,
      })),
    };
    (categoriesByLocation[category.locationId] ??= []).push(option);
  }

  // Filtre çubuğu yalnız seçili lokasyonun (ya da hepsinin) kategorilerini
  // gösterir; başka lokasyonun kategorisiyle filtrelemek anlamsız olurdu.
  const filterCategories = selectedLocation
    ? (categoriesByLocation[selectedLocation] ?? [])
    : categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        fields: [],
      }));

  const categoryFilter =
    requestedCategory && categories.some((c) => c.id === requestedCategory)
      ? requestedCategory
      : null;

  const vendorsByLocation: Record<
    string,
    Array<{ id: string; name: string }>
  > = {};
  for (const vendor of vendors) {
    (vendorsByLocation[vendor.locationId] ??= []).push({
      id: vendor.id,
      name: vendor.name,
    });
  }

  const editableLocations = locations.filter(
    (l) => l.role === "OWNER" || l.role === "EDITOR",
  );

  // Filtre paneli: boş grup hiç çizilmiyor (tek lokasyonlu kullanıcıya
  // "lokasyon" başlığı gereksiz), zimmet grubu ancak özellik kullanılıyorsa.
  const filterGroups: FilterGroup[] = [
    {
      key: "durum",
      title: "Durum",
      anyLabel: "Tümü",
      options: ITEM_STATUS.map((option) => ({
        value: option,
        label: ITEM_STATUS_LABELS[option],
      })),
    },
    ...(locations.length > 1
      ? [
          {
            key: "lokasyon",
            title: "Lokasyon",
            anyLabel: "Tüm lokasyonlar",
            options: locations.map((location) => ({
              value: location.id,
              label: `${location.icon ?? "📍"} ${location.name}`,
            })),
          },
        ]
      : []),
    ...(filterCategories.length
      ? [
          {
            key: "kategori",
            title: "Kategori",
            anyLabel: "Tüm kategoriler",
            options: filterCategories.map((category) => ({
              value: category.id,
              label: `${category.icon ?? "🏷"} ${category.name}`,
            })),
          },
        ]
      : []),
    ...(hasAssignments || assignmentFilter
      ? [
          {
            key: "zimmet",
            title: "Zimmet",
            anyLabel: "Tüm zimmetler",
            options: ZIMMET_FILTERS.map((option) => ({
              value: option,
              label: ZIMMET_LABELS[option],
            })),
          },
        ]
      : []),
  ];

  /** Açık filtrelerin okunur adı; listenin üstünde tek satırda duruyor. */
  const activeFilters = filterGroups.flatMap((group) => {
    const value = filters[group.key as keyof Search];
    const option = group.options.find((candidate) => candidate.value === value);
    return option ? [{ key: group.key, label: option.label }] : [];
  });

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
              extractionEnabled={isExtractionConfigured()}
            />
          ) : undefined
        }
      />

      <div className="flex items-center gap-2 px-4 pt-3">
        <SearchField defaultValue={query} />
        <Filters groups={filterGroups} current={filters} />
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
      {/* Etkin filtreler tek satırda ve kaldırılabilir: panelin açık olduğunu
          hatırlamak kullanıcının işi olmasın. */}
      {activeFilters.length ? (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          {activeFilters.map((active) => (
            <Link
              key={active.key}
              href={buildHref({ ...filters, [active.key]: undefined, sayfa: undefined })}
              aria-label={`${active.label} filtresini kaldır`}
              className="flex min-h-touch shrink-0 items-center gap-1 whitespace-nowrap rounded-card bg-blue px-3 text-footnote text-white active:opacity-60"
            >
              {active.label}
              <span aria-hidden>✕</span>
            </Link>
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
        <Group
          title={
            pageCount > 1
              ? `${total} ekipman · sayfa ${page}/${pageCount}`
              : `${total} ekipman`
          }
        >
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
                  editable={editableLocations.some(
                    (l) => l.id === item.location.id,
                  )}
                >
                  <Row
                    badgesBelow
                    href={`/envanter/${item.id}`}
                    leading={
                      <ItemPhoto
                        itemId={item.id}
                        name={item.name}
                        url={item.attachments[0]?.url ?? null}
                        icon={item.category?.icon ?? null}
                        editable={editableLocations.some(
                          (l) => l.id === item.location.id,
                        )}
                      />
                    }
                    title={item.name}
                    subtitle={details || "Ayrıntı girilmemiş"}
                    badge={
                      <>
                        {item.status !== "IN_USE" ? (
                          <Badge
                            tone={
                              item.status === "IN_REPAIR" ? "orange" : "muted"
                            }
                          >
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
                        {/* Tutar da rozet sırasında: sağda dururken uzun
                            adları erkenden kırpıyordu. */}
                        {item.purchasePriceMinor != null ? (
                          <span className="text-footnote text-muted">
                            {formatMoney(item.purchasePriceMinor, item.currency)}
                          </span>
                        ) : null}
                      </>
                    }
                  />
                </ItemSwipe>
              );
            })}
          </Rows>
        </Group>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Sayfalar"
          className="flex items-center justify-between gap-3 px-4 pt-4"
        >
          <PageLink
            href={buildHref({ ...filters, sayfa: String(page - 1) })}
            enabled={page > 1}
          >
            ‹ Önceki
          </PageLink>
          <span className="text-footnote text-muted">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} /{" "}
            {total}
          </span>
          <PageLink
            href={buildHref({ ...filters, sayfa: String(page + 1) })}
            enabled={page < pageCount}
          >
            Sonraki ›
          </PageLink>
        </nav>
      ) : null}
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
  if (params.sayfa) query.set("sayfa", params.sayfa);
  const text = query.toString();
  return text ? `/envanter?${text}` : "/envanter";
}

/** Sayfa bağlantısı. Sınırdaki yön bağlantı değil, soluk bir etiket. */
function PageLink({
  href,
  enabled,
  children,
}: {
  href: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return (
      <span className="min-h-touch px-2 py-2 text-body text-muted opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="min-h-touch px-2 py-2 text-body text-blue active:opacity-60"
    >
      {children}
    </Link>
  );
}

