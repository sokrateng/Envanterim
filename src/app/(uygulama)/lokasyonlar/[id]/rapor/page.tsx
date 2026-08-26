import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { requireLocation } from "@/lib/access";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";
import type { TimelineEvent } from "@/lib/events";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  coverageNotes,
  reportable,
  sortForReport,
  summarize,
  type ReportItem,
} from "@/lib/report";
import { warrantyStatus } from "@/lib/warranty";

export const dynamic = "force-dynamic";

const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Sigorta raporu: yangın, hırsızlık, sel durumunda sigortaya verilecek belge
 * (docs/URUN.md). Yazdırma penceresinden PDF olarak kaydediliyor — ayrı bir
 * PDF kütüphanesi taşımıyoruz.
 */
export default async function RaporPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      name: true,
      items: {
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
          attachments: {
            where: { kind: "PHOTO" },
            select: { url: true },
            orderBy: { uploadedAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!location) notFound();

  const items: ReportItem[] = location.items.map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    model: item.model,
    serialNo: item.serialNo,
    categoryName: item.category?.name ?? null,
    place: item.place,
    status: item.status,
    purchaseDate: item.purchaseDate,
    purchasePriceMinor: item.purchasePriceMinor,
    currency: item.currency,
    warrantyEndDate: item.warrantyEndDate,
    photoUrl: item.attachments[0]?.url ?? null,
    events: item.events.map((event) => ({
      kind: event.kind as TimelineEvent["kind"],
      costMinor: event.costMinor,
    })),
    partPricesMinor: item.parts.map((part) => part.priceMinor),
  }));

  const listed = sortForReport(reportable(items));
  const summary = summarize(listed);
  const notes = coverageNotes(summary);
  const today = new Date();

  return (
    <Screen>
      <ScreenHeader
        title="Sigorta raporu"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
      />

      <div className="px-4 pt-3 print:hidden">
        <p className="text-footnote text-muted">
          Yazdır penceresinden &quot;PDF olarak kaydet&quot;i seçebilirsin.
          Emekli ve satılmış ekipmanlar rapora girmiyor.
        </p>
        <div className="pt-3">
          <PrintButton>PDF olarak kaydet</PrintButton>
        </div>
      </div>

      {/* Çıktının kendisi: ekranda da aynısı görünüyor. */}
      <article className="mt-4 bg-white px-4 py-4 text-black print:mt-0 print:px-0">
        <header className="border-b border-neutral-300 pb-2">
          <h2 className="text-title">{location.name} — envanter raporu</h2>
          <p className="text-footnote text-neutral-600">
            {trDate.format(today)} tarihinde oluşturuldu · {summary.itemCount} ekipman
          </p>
        </header>

        {/* Toplamlar para birimi başına: farklı birimler toplanmıyor, kur
            çevrilmiyor. Tek birimli envanterde tek blok çıkıyor. */}
        {summary.byCurrency.map((group) => (
          <div key={group.currency}>
            <section className="grid grid-cols-2 gap-2 py-3">
              <Summary
                label={
                  summary.byCurrency.length > 1
                    ? `Toplam alış değeri (${group.currency})`
                    : "Toplam alış değeri"
                }
                value={formatMoney(group.purchaseTotalMinor, group.currency)}
              />
              <Summary
                label="Sahip olma maliyeti"
                value={formatMoney(group.ownershipTotalMinor, group.currency)}
              />
              {summary.byCurrency.length > 1 ? (
                <Summary label="Ekipman" value={`${group.itemCount} ekipman`} />
              ) : null}
            </section>

            {group.byCategory.length ? (
              <section className="pb-3">
                <h3 className="text-footnote uppercase text-neutral-500">
                  Kategoriye göre
                  {summary.byCurrency.length > 1 ? ` · ${group.currency}` : ""}
                </h3>
                <table className="w-full text-footnote">
                  <tbody>
                    {group.byCategory.map((row) => (
                      <tr key={row.name} className="border-b border-neutral-200">
                        <td className="py-1">{row.name}</td>
                        <td className="py-1 text-right text-neutral-600">
                          {row.count} adet
                        </td>
                        <td className="py-1 text-right">
                          {formatMoney(row.purchaseMinor, group.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </div>
        ))}

        <section className="grid grid-cols-2 gap-2 pb-3">
          <Summary label="Fotoğraflı" value={`${summary.withPhoto} / ${summary.itemCount}`} />
          <Summary label="Garantisi süren" value={`${summary.warrantyActive} ekipman`} />
        </section>

        <section>
          <h3 className="text-footnote uppercase text-neutral-500">Ekipmanlar</h3>
          <ul>
            {listed.map((item) => {
              const warranty = warrantyStatus(item.warrantyEndDate);
              const details = [
                [item.brand, item.model].filter(Boolean).join(" "),
                item.serialNo ? `SN ${item.serialNo}` : null,
                item.categoryName,
                item.place,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={item.id}
                  className="flex gap-3 border-b border-neutral-200 py-2 [break-inside:avoid]"
                >
                  {item.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded bg-neutral-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-headline">{item.name}</p>
                    {details ? (
                      <p className="text-caption text-neutral-600">{details}</p>
                    ) : null}
                    <p className="text-caption text-neutral-600">
                      {item.purchaseDate ? trDate.format(item.purchaseDate) : "Alış tarihi yok"}
                      {" · "}
                      {warranty.state === "none" ? "Garanti bilgisi yok" : warranty.label}
                      {item.status !== "IN_USE"
                        ? ` · ${ITEM_STATUS_LABELS[item.status as ItemStatus]}`
                        : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-subheadline">
                    {item.purchasePriceMinor == null
                      ? "—"
                      : formatMoney(item.purchasePriceMinor, item.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {notes.length ? (
          <section className="pt-3">
            <h3 className="text-footnote uppercase text-neutral-500">Kapsam</h3>
            {notes.map((note) => (
              <p key={note} className="text-caption text-neutral-600">
                {note}
              </p>
            ))}
          </section>
        ) : null}

        <footer className="pt-3 text-caption text-neutral-500">
          Envanterim · Bu rapor girilen kayıtlardan üretildi; tutarlar alış
          bedelidir, güncel piyasa değeri değildir.
        </footer>
      </article>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 p-2">
      <p className="text-caption uppercase text-neutral-500">{label}</p>
      <p className="text-headline">{value}</p>
    </div>
  );
}
