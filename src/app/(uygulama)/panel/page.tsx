import Link from "next/link";
import { EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { BarList, Card, Meter, StatTile, YearBars } from "@/components/charts";
import { listMyLocations } from "@/lib/access";
import {
  activeItems,
  byPurchaseYear,
  coverage,
  currencyTotals,
  rankBy,
  statusBreakdown,
  topValued,
  warrantyBreakdown,
  type Ranked,
} from "@/lib/dashboard";
import type { TimelineEvent } from "@/lib/events";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { ReportItem } from "@/lib/report";
import { requireUser } from "@/lib/session";
import { daysUntilWarrantyEnd } from "@/lib/warranty";
import { Money } from "./Money";

export const metadata = { title: "Panel — Envanterim" };
export const dynamic = "force-dynamic";

/** Kaç gün kalınca "yaklaşıyor" sayılıyor; kartın başlığı da bunu yazıyor. */
const SOON_DAYS = 90;

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ lokasyon?: string }>;
}) {
  const { lokasyon } = await searchParams;
  const user = await requireUser();
  const locations = await listMyLocations(user.id);

  // Yetki lokasyon üyeliğinden geçiyor (CLAUDE.md): sorgu yalnız üye olunan
  // lokasyonlara bakıyor, adresten gelen lokasyon bu kümeyle kesiştiriliyor.
  const memberLocationIds = locations.map((l) => l.id);
  const selected = memberLocationIds.includes(lokasyon ?? "")
    ? (lokasyon as string)
    : null;
  const scope = selected ? [selected] : memberLocationIds;

  const rows = memberLocationIds.length
    ? await prisma.item.findMany({
        where: { locationId: { in: scope } },
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serialNo: true,
          place: true,
          status: true,
          currency: true,
          purchaseDate: true,
          purchasePriceMinor: true,
          warrantyEndDate: true,
          category: { select: { name: true } },
          events: { select: { kind: true, costMinor: true } },
          parts: { select: { priceMinor: true } },
          serviceJobs: { select: { costMinor: true, underWarranty: true } },
          attachments: {
            where: { kind: "PHOTO" },
            select: { url: true },
            take: 1,
          },
          // Zimmet ayrı bir durum değil, kullanımın türü: açık kayıt var mı,
          // o kadarı yetiyor.
          assignments: { where: { closedAt: null }, select: { id: true }, take: 1 },
        },
      })
    : [];

  // Panelin girdisi sigorta raporununkiyle aynı satır tipi: iki ekran aynı
  // veriye baksın, biri "12 ekipman" derken öteki "13" demesin.
  const items: Array<ReportItem & { assigned: boolean }> = rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNo: row.serialNo,
    categoryName: row.category?.name ?? null,
    place: row.place,
    status: row.status,
    purchaseDate: row.purchaseDate,
    purchasePriceMinor: row.purchasePriceMinor,
    currency: row.currency,
    warrantyEndDate: row.warrantyEndDate,
    photoUrl: row.attachments[0]?.url ?? null,
    events: row.events.map((event) => ({
      kind: event.kind as TimelineEvent["kind"],
      costMinor: event.costMinor,
    })),
    partPricesMinor: row.parts.map((part) => part.priceMinor),
    // Garanti kapsamındaki servis maliyete girmiyor (src/lib/service.ts).
    servicePricesMinor: row.serviceJobs.map((job) =>
      job.underWarranty ? null : job.costMinor,
    ),
    assigned: row.assignments.length > 0,
  }));

  const aktif = activeItems(items);
  const durum = statusBreakdown(items);
  const garanti = warrantyBreakdown(aktif);
  const kategori = rankBy(aktif, (item) => item.categoryName, {
    emptyLabel: "Kategorisiz",
  });
  const marka = rankBy(aktif, (item) => item.brand, { emptyLabel: "Markasız" });
  const yillar = byPurchaseYear(aktif);
  const degerli = topValued(aktif);
  const kapsam = coverage(aktif);
  const paralar = currencyTotals(aktif);

  const yaklasan = aktif.filter((item) => {
    const kalan = daysUntilWarrantyEnd(item.warrantyEndDate);
    return kalan !== null && kalan >= 0 && kalan <= SOON_DAYS;
  }).length;
  const serviste = items.filter((item) => item.status === "IN_REPAIR").length;

  /** Kutudaki sayı kartın satırıyla aynı olsun diye tek kaynaktan okunuyor. */
  const durumSayisi = (label: string) =>
    durum.find((row) => row.label === label)?.count ?? 0;

  const secilenAd = selected
    ? (locations.find((l) => l.id === selected)?.name ?? null)
    : null;

  return (
    <Screen>
      <ScreenHeader title="Genel bakış" />

      {locations.length > 1 ? (
        <nav
          aria-label="Lokasyon"
          className="flex gap-2 overflow-x-auto px-4 pt-3"
        >
          <LocationChip href="/panel" active={!selected}>
            Tüm lokasyonlar
          </LocationChip>
          {locations.map((location) => (
            <LocationChip
              key={location.id}
              href={`/panel?lokasyon=${location.id}`}
              active={selected === location.id}
            >
              {location.icon ?? "📍"} {location.name}
            </LocationChip>
          ))}
        </nav>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Gösterilecek veri yok"
          description={
            locations.length === 0
              ? "Ekipman bir lokasyona bağlanır. Lokasyonlar sekmesinden başla."
              : "Bu lokasyonda henüz ekipman yok."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-4 pt-3">
            <StatTile
              label="Ekipman"
              value={String(items.length)}
              note={
                items.length !== aktif.length
                  ? `${aktif.length} tanesi elde`
                  : undefined
              }
              tone="blue"
            />
            <StatTile
              label="Kullanımda"
              value={String(durumSayisi("Kullanımda"))}
              note={
                durumSayisi("Zimmetli")
                  ? `${durumSayisi("Zimmetli")} tanesi zimmetli`
                  : undefined
              }
              tone="green"
            />
            <StatTile
              label="Garantisi yakın"
              value={String(yaklasan)}
              note={`${SOON_DAYS} gün içinde bitiyor`}
              tone="orange"
            />
            <StatTile
              label="Serviste"
              value={String(serviste)}
              tone={serviste ? "orange" : "muted"}
            />
          </div>

          <Money rows={paralar} />

          <Card
            title="Durum"
            hint="Zimmet ayrı bir durum değil, kullanımın türü — listedeki gibi sayılıyor."
          >
            <BarList
              rows={durum.map((row) => ({
                key: row.key,
                label: row.label,
                value: `${row.count} · %${row.share}`,
                share: row.share,
                tone: row.tone,
              }))}
            />
          </Card>

          {garanti.length ? (
            <Card
              title="Garanti"
              hint="Kovalar ayrık: her ekipman tek satırda sayılıyor."
            >
              <BarList
                rows={garanti.map((row) => ({
                  key: row.key,
                  label: row.label,
                  value: `${row.count} · %${row.share}`,
                  share: row.share,
                  tone: row.tone,
                }))}
              />
            </Card>
          ) : null}

          <Card
            title="Kategori"
            hint={katlanan(kategori, "kategori")}
          >
            <BarList
              rows={kategori.map((row) => ({
                key: row.key,
                label: row.label,
                value: `${row.count} · %${row.share}`,
                share: row.share,
              }))}
            />
          </Card>

          <Card title="Marka" hint={katlanan(marka, "marka")}>
            <BarList
              rows={marka.map((row) => ({
                key: row.key,
                label: row.label,
                value: `${row.count} · %${row.share}`,
                share: row.share,
              }))}
            />
          </Card>

          {yillar.length ? (
            <Card
              title="Alış yılı"
              hint="Envanterin yaş profili: yenileme sırası kime geliyor."
            >
              <YearBars rows={yillar} />
            </Card>
          ) : null}

          {degerli.length ? (
            <Card title="En değerli ekipmanlar">
              <ul className="space-y-2">
                {degerli.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/envanter/${item.id}`}
                      className="flex min-h-touch items-center justify-between gap-3 active:opacity-60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-subheadline">
                          {item.name}
                        </span>
                        <span className="block truncate text-caption text-muted">
                          {item.detail}
                        </span>
                      </span>
                      <span className="shrink-0 text-subheadline tabular-nums">
                        {formatMoney(item.minor, item.currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card
            title="Kayıt eksikleri"
            hint="Paneldeki her sayı girilen veriden geliyor; eksik kayıt toplamı olduğundan küçük gösterir."
          >
            <div className="space-y-2.5">
              <Meter
                label="Alış tutarı girilmiş"
                value={kapsam.withPrice}
                total={kapsam.total}
              />
              <Meter
                label="Fotoğrafı var"
                value={kapsam.withPhoto}
                total={kapsam.total}
              />
              <Meter
                label="Seri no girilmiş"
                value={kapsam.withSerial}
                total={kapsam.total}
              />
              <Meter
                label="Garanti tarihi girilmiş"
                value={kapsam.withWarranty}
                total={kapsam.total}
              />
            </div>
          </Card>

          <p className="px-8 pt-4 text-caption text-muted">
            Durum kartı bütün ekipmanları sayıyor; tutar, garanti, kategori ve
            marka kartları elde olanlara bakıyor — pasif ve satılmış ekipman
            dışarıda. {secilenAd ? `Kapsam: ${secilenAd}.` : null}
          </p>
        </>
      )}
    </Screen>
  );
}

/** "Diğer"e kaç grup girdiğini yazan not; katlama olmadıysa not da yok. */
function katlanan(rows: Ranked[], birim: string): string | undefined {
  const groups = rows.find((row) => row.key === "__diger__")?.groups;
  return groups ? `${groups} ${birim} "Diğer"de toplandı.` : undefined;
}

function LocationChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`grid min-h-touch shrink-0 place-items-center whitespace-nowrap rounded-card px-3 text-footnote transition active:scale-95 ${
        active ? "bg-blue text-white" : "bg-surface text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
