import Link from "next/link";
import {
  EmptyState,
  Group,
  Row,
  Rows,
  Screen,
  ScreenHeader,
  StatusMark,
} from "@/components/ui";
import { listMyLocations } from "@/lib/access";
import {
  ITEM_STATUS,
  ITEM_STATUS_LABELS,
  type FieldType,
  type ItemStatus,
} from "@/lib/constants";
import type { CategoryOption } from "@/components/ItemFields";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { favoritePage } from "@/lib/favorite-page";
import { parseValues } from "@/lib/filter-values";
import { statusView } from "@/lib/item-status";
import { listVendors } from "@/lib/vendors";
import {
  WARRANTY_FILTERS,
  WARRANTY_FILTER_LABELS,
  warrantyRange,
  warrantyStatus,
} from "@/lib/warranty";
import {
  activeAssignment,
  assignmentState,
  holderSummary,
  isOverdue,
} from "@/lib/assignment";
import { ItemPhoto } from "@/components/ItemPhoto";
import { ItemSwipe } from "./ItemSwipe";
import { isExtractionConfigured } from "@/lib/invoice-extract";
import { NewItemButton } from "./NewItemButton";
import { SearchField } from "./SearchField";
import { Filters, type FilterGroup } from "./Filters";
import { MoreRows } from "./MoreRows";

export const metadata = { title: "Envanter — Envanterim" };
export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  durum?: string;
  lokasyon?: string;
  kategori?: string;
  garanti?: string;
  zimmet?: string;
  favori?: string;
  yeni?: string;
  seri?: string;
  sayfa?: string;
};

/**
 * Bir dilimde kaç ekipman. Liste aşağı indikçe uzuyor: adresteki `sayfa`
 * kaçıncı sayfa değil, **kaç dilim yüklendiği** demek (`sayfa=3` → 150 satır).
 * Satırları hep sunucu çiziyor, istemci yalnız "bir dilim daha" diyor.
 */
const PAGE_SIZE = 50;

/**
 * Kaçıncı dilimden sonra kullanıcı basarak devam ediyor. Sınırsız
 * kendiliğinden yükleme, kalabalık bir envanterde tarayıcıyı boğuyor: her
 * dilimde liste baştan çiziliyor.
 */
const AUTO_PAGES = 10;

/** Adresle istenebilecek en çok dilim; ötesi süzmenin işi. */
const MAX_PAGES = 40;

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
  // Çoklu seçim: "pasif hariç hepsi" demenin yolu kalanları işaretlemek
  // (src/lib/filter-values.ts). İzinli küme dışındaki değer eleniyor.
  const selectedLocations = parseValues(filters.lokasyon, memberLocationIds);
  /** Tek lokasyon süzülüyorsa bazı yerler onu ayrıca kullanıyor. */
  const selectedLocation =
    selectedLocations.length === 1 ? selectedLocations[0] : null;

  const statuses = parseValues(filters.durum, ITEM_STATUS);
  // Kategori kimlikleri sorgudan önce bilinmiyor; satırlar zaten üye olunan
  // lokasyonlarla sınırlı, uydurma bir kimlik hiçbir satıra denk gelmiyor.
  const selectedCategories = parseValues(filters.kategori, null);

  const assignmentFilter = ZIMMET_FILTERS.includes(
    filters.zimmet as ZimmetFilter,
  )
    ? (filters.zimmet as ZimmetFilter)
    : null;

  // Garanti penceresi tek seçimli: pencereler iç içe (30 ⊂ 90 ⊂ 180 ⊂ 365),
  // birleşimleri zaten geniş olanı verirdi (src/lib/warranty.ts).
  const warrantyWindow = warrantyRange(filters.garanti ?? "");

  const onlyFavorites = filters.favori === "1";
  const query = (filters.q ?? "").trim();

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
    locationId: selectedLocations.length
      ? { in: selectedLocations }
      : { in: memberLocationIds },
    ...(statuses.length ? { status: { in: statuses } } : {}),
    // Kategori kimliği doğrudan kullanılıyor: satırlar zaten üye olunan
    // lokasyonlarla sınırlı, başka lokasyonun kategorisi eşleşemez. Böylece
    // liste sorgusu kategori listesini beklemiyor.
    ...(selectedCategories.length
      ? { categoryId: { in: selectedCategories } }
      : {}),
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
    // Garanti aralığı: tarihi olmayan ekipman kendiliğinden eleniyor.
    ...(warrantyWindow ? { warrantyEndDate: warrantyWindow } : {}),
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
    // Favori kişisel: başkasının işareti listeyi etkilemiyor.
    ...(onlyFavorites ? { favorites: { some: { userId: user.id } } } : {}),
  };

  // Adresteki `sayfa` kaç dilimin yüklendiğini söylüyor; ilk satırdan
  // itibaren o kadar satır çiziliyor. Üst sınır uydurma bir adresin
  // veritabanına milyonluk bir `take` göndermesini engelliyor.
  const page = Math.min(Math.max(1, Number(filters.sayfa) || 1), MAX_PAGES);
  const loaded = page * PAGE_SIZE;

  /** Satır için çekilen alanlar; iki sorgu da aynısını istiyor. */
  const satirSecimi = {
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
      where: { kind: "PHOTO" as const },
      select: { url: true },
      orderBy: { uploadedAt: "asc" as const },
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
  };

  const favorimMi = { favorites: { some: { userId: user.id } } };

  /**
   * Favoriler listenin başında duruyor. Tek sorguda sıralanamıyor: ilişki
   * sayısına göre sıralamak başkasının işaretini de sayardı, favori ise
   * kişisel. Bu yüzden iki dilim — hangi sayfanın nereye denk geldiğini
   * `favoritePage` söylüyor (saf ve testli).
   */
  const listeIstegi = memberLocationIds.length
    ? (async () => {
        const [total, favoriteCount] = await prisma.$transaction([
          prisma.item.count({ where }),
          prisma.item.count({ where: { ...where, ...favorimMi } }),
        ]);

        // Dilimler birikiyor: pencere hep ilk satırdan başlıyor, boyu
        // yüklenen dilim sayısı kadar.
        const dilim = favoritePage({
          offset: 0,
          size: loaded,
          favoriteCount,
        });

        const [favoriler, kalanlar] = await prisma.$transaction([
          prisma.item.findMany({
            where: { ...where, ...favorimMi },
            select: satirSecimi,
            orderBy: [{ updatedAt: "desc" }],
            skip: dilim.favoriteSkip,
            take: dilim.favoriteTake,
          }),
          prisma.item.findMany({
            where: { ...where, favorites: { none: { userId: user.id } } },
            select: satirSecimi,
            orderBy: [{ updatedAt: "desc" }],
            skip: dilim.otherSkip,
            take: dilim.otherTake,
          }),
        ]);

        return [
          total,
          [
            ...favoriler.map((item) => ({ ...item, favorite: true })),
            ...kalanlar.map((item) => ({ ...item, favorite: false })),
          ],
        ] as const;
      })()
    : Promise.resolve([0, [] as Array<never>] as const);

  // Birbirine bağlı olmayan sorgular birlikte gidiyor: sırayla beklemek
  // uzak bölgedeki veritabanında her biri için ayrı bir tur demek.
  const [[total, items], categories, acikZimmet, sellers] = await Promise.all([
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
    // Firmalar lokasyondan bağımsız: hangi lokasyona eklersen ekle aynı
    // satıcı listesi çıkıyor (src/lib/vendors.ts).
    listVendors(user.id, "seller"),
  ]);

  const hasAssignments = acikZimmet > 0;

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


  /** Boş listede "filtreden mi geliyor" sorusunun cevabı. */
  const activeFilterCount = [
    statuses.length,
    selectedLocations.length,
    selectedCategories.length,
    warrantyWindow ? 1 : 0,
    onlyFavorites ? 1 : 0,
    assignmentFilter ? 1 : 0,
  ].filter(Boolean).length;

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
      multiple: true,
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
            multiple: true,
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
            multiple: true,
            options: filterCategories.map((category) => ({
              value: category.id,
              label: `${category.icon ?? "🏷"} ${category.name}`,
            })),
          },
        ]
      : []),
    {
      key: "garanti",
      title: "Garanti",
      anyLabel: "Tümü",
      options: WARRANTY_FILTERS.map((option) => ({
        value: option,
        label: WARRANTY_FILTER_LABELS[option],
      })),
    },
    {
      key: "favori",
      title: "Favoriler",
      anyLabel: "Tümü",
      options: [{ value: "1", label: "Yalnız favorilerim" }],
    },
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

  return (
    <Screen>
      <ScreenHeader title="Envanter" />

      {/* Panel burada duruyor ama düğmesi yok: ekleme yolu sekme çubuğundaki
          düğme (adrese `yeni=1` koyuyor). Başlıkta ikinci bir kapı gereksizdi. */}
      {editableLocations.length ? (
        <NewItemButton
          trigger={false}
          locations={editableLocations.map((l) => ({
            id: l.id,
            name: l.name,
          }))}
          // Süzülen lokasyon panele geçiyor. Yalnız düzenleyebildiğim
          // lokasyon işe yarar: görüntüleyici olduğum lokasyona ekipman
          // ekleyemem, açılır listede de yok.
          defaultLocationId={
            editableLocations.find((l) => l.id === selectedLocation)?.id ??
            editableLocations[0].id
          }
          categoriesByLocation={categoriesByLocation}
          sellers={sellers}
          extractionEnabled={isExtractionConfigured()}
          autoOpen={filters.yeni === "1"}
          presetSerial={filters.seri ?? ""}
        />
      ) : null}

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
      {locations.length === 0 ? (
        <EmptyState
          title="Önce bir lokasyon aç"
          description="Ekipman bir lokasyona bağlanır. Lokasyonlar sekmesinden başla."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Ekipman yok"
          description={
            query || activeFilterCount
              ? "Bu filtreyle eşleşen ekipman bulunamadı."
              : "Alttaki + ile ilk ekipmanını ekle."
          }
        />
      ) : (
        <Group title={`${total} ekipman`}>
          <Rows divider="leading">
            {visible.map((item) => {
              const warranty = warrantyStatus(item.warrantyEndDate);
              const durum = statusView(
                item.status as ItemStatus,
                item.active !== null,
              );
              const details = [
                item.active ? item.holder : null,
                [item.brand, item.model].filter(Boolean).join(" "),
                item.category?.name ?? null,
                item.serialNo ? `SN ${item.serialNo}` : null,
                // Lokasyon adı ancak ayırt ediyorsa satırda: tek lokasyonu
                // olan kullanıcıda her satıra aynı kelimeyi yazmak yer
                // kaybı, süzülmüşken de zaten filtre çipinde yazıyor.
                locations.length > 1 && !selectedLocation
                  ? item.location.name
                  : null,
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
                    title={
                      item.favorite ? (
                        <>
                          {/* Favori satırda küçük bir işaret: liste başında
                              olduğunu görmek için sıralamaya güvenmek yetmiyor,
                              filtre değişince sıra da değişiyor. */}
                          <span aria-hidden className="text-red">
                            ♥
                          </span>{" "}
                          <span className="sr-only">Favori: </span>
                          {item.name}
                        </>
                      ) : (
                        item.name
                      )
                    }
                    subtitle={details || "Ayrıntı girilmemiş"}
                    trailing={
                      <StatusMark
                        tone={durum.tone}
                        label={durum.label}
                        // Garanti bilgisi yoksa satır hiç çıkmıyor: "bilgi
                        // yok" yazısı adın yerini yiyordu, oysa yokluğu
                        // boşluk da anlatıyor.
                        note={
                          warranty.state === "none" ? undefined : warranty.label
                        }
                        noteTone={
                          warranty.state === "active"
                            ? "green"
                            : warranty.state === "ending-soon"
                              ? "orange"
                              : "muted"
                        }
                      />
                    }
                  />
                </ItemSwipe>
              );
            })}
          </Rows>
        </Group>
      )}

      <MoreRows
        page={page}
        shown={visible.length}
        total={total}
        autoPages={AUTO_PAGES}
      />
    </Screen>
  );
}
