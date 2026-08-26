import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import {
  EVENT_KIND_LABELS,
  eventSummary,
  type TimelineEvent,
} from "@/lib/events";
import { ITEM_STATUS_LABELS, type FieldType, type ItemStatus } from "@/lib/constants";
import { readCustomFields, type FieldDef } from "@/lib/custom-fields";
import { prisma } from "@/lib/prisma";
import { isValidToken, shareState } from "@/lib/share";
import { warrantyStatus } from "@/lib/warranty";

export const dynamic = "force-dynamic";

/** Paylaşılan sayfa arama motorlarına girmesin. */
export const metadata: Metadata = {
  title: "Ekipman kaydı — Envanterim",
  robots: { index: false, follow: false, nocache: true },
};

const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Salt-okunur ekipman sayfası. Girişsiz açılıyor: servise giderken teknisyen
 * bunu görüyor (docs/URUN.md).
 *
 * **Tutarlar burada yok.** Servisin görmesi gereken şey ne yapıldığı; alış
 * bedeli, servis ücreti ve parça fiyatı paylaşılmıyor.
 */
export default async function PaylasimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Biçimi tutmayan anahtar için veritabanına hiç gitme.
  if (!isValidToken(token)) notFound();

  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      item: {
        select: {
          name: true,
          brand: true,
          model: true,
          serialNo: true,
          place: true,
          status: true,
          purchaseDate: true,
          warrantyEndDate: true,
          customFields: true,
          location: { select: { name: true } },
          category: {
            select: {
              name: true,
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
          },
          events: {
            select: {
              id: true,
              kind: true,
              date: true,
              note: true,
              readingValue: true,
              readingUnit: true,
              vendor: { select: { name: true } },
            },
            orderBy: { date: "desc" },
            take: 50,
          },
          parts: { select: { id: true, name: true, partNo: true } },
          attachments: {
            where: { kind: "PHOTO" },
            select: { id: true, url: true, name: true },
            take: 6,
          },
        },
      },
    },
  });

  // Süresi dolmuş ya da iptal edilmiş bağlantı, olmayan bağlantıyla aynı:
  // hangi ürünün var olduğu bile sızmasın.
  if (!link || shareState(link) !== "valid") notFound();

  // Görüntülenme sayacı yanıttan önce yazılıyor (TUZAKLAR #1).
  await prisma.shareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });

  const item = link.item;
  const warranty = warrantyStatus(item.warrantyEndDate);
  const fieldDefs: FieldDef[] = (item.category?.fields ?? []).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type as FieldType,
    required: field.required,
    options: Array.isArray(field.options) ? (field.options as string[]) : null,
    hidden: field.hidden,
  }));
  const customRows = readCustomFields(item.customFields, fieldDefs);

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-10 pt-[calc(env(safe-area-inset-top)+16px)]">
      <p className="text-footnote text-muted">Envanterim · paylaşılan kayıt</p>
      <h1 className="text-large-title tracking-tight">{item.name}</h1>

      <div className="flex flex-wrap gap-2 pt-2">
        <Badge tone={item.status === "IN_REPAIR" ? "orange" : "muted"}>
          {ITEM_STATUS_LABELS[item.status as ItemStatus]}
        </Badge>
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
      </div>

      <Section title="Ekipman">
        <Row label="Marka" value={[item.brand, item.model].filter(Boolean).join(" ")} />
        <Row label="Seri no" value={item.serialNo} />
        <Row label="Kategori" value={item.category?.name ?? null} />
        <Row label="Yer" value={[item.location.name, item.place].filter(Boolean).join(" · ")} />
        <Row
          label="Alış tarihi"
          value={item.purchaseDate ? trDate.format(item.purchaseDate) : null}
        />
        <Row
          label="Garanti bitişi"
          value={item.warrantyEndDate ? trDate.format(item.warrantyEndDate) : null}
        />
      </Section>

      {customRows.length ? (
        <Section title={`${item.category?.name ?? "Özel"} alanları`}>
          {customRows.map((row) => (
            <Row key={row.key} label={row.label} value={row.text} />
          ))}
        </Section>
      ) : null}

      {item.attachments.length ? (
        <section className="pt-5">
          <h2 className="pb-2 text-footnote uppercase text-muted">Fotoğraflar</h2>
          <div className="grid grid-cols-3 gap-2">
            {item.attachments.map((photo) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={photo.id}
                // Yerel depolamada dosya ucu üyelik istiyor; paylaşım
                // anahtarı bu ekipmanın dosyalarını açıyor.
                src={
                  photo.url.startsWith("/api/dosya/")
                    ? `${photo.url}?p=${token}`
                    : photo.url
                }
                alt={photo.name}
                className="aspect-square w-full rounded-card object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {item.events.length ? (
        <section className="pt-5">
          <h2 className="pb-2 text-footnote uppercase text-muted">Geçmiş</h2>
          <ul className="divide-y divide-separator overflow-hidden rounded-card bg-surface">
            {item.events.map((event) => {
              // Tutar alanı bilerek geçilmiyor: paylaşılan sayfada para yok.
              const summary = eventSummary(
                {
                  id: event.id,
                  kind: event.kind as TimelineEvent["kind"],
                  date: event.date,
                  note: event.note,
                  costMinor: null,
                  readingValue: event.readingValue,
                  readingUnit: event.readingUnit,
                  vendorName: event.vendor?.name ?? null,
                  assignedToName: null,
                  assignedPlace: null,
                },
                "TRY",
              );

              return (
                <li key={event.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-headline">{trDate.format(event.date)}</span>
                    <Badge tone="muted">
                      {EVENT_KIND_LABELS[event.kind as TimelineEvent["kind"]]}
                    </Badge>
                  </div>
                  {summary ? (
                    <div className="text-footnote text-muted">{summary}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {item.parts.length ? (
        <Section title="Yedek parçalar">
          {item.parts.map((part) => (
            <Row key={part.id} label={part.name} value={part.partNo ? `No ${part.partNo}` : "—"} />
          ))}
        </Section>
      ) : null}

      <p className="pt-6 text-footnote text-muted">
        Bu bağlantı {trDate.format(link.expiresAt)} tarihine kadar geçerli.
        Tutarlar paylaşılmaz.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-5">
      <h2 className="pb-2 text-footnote uppercase text-muted">{title}</h2>
      <div className="divide-y divide-separator overflow-hidden rounded-card bg-surface">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex min-h-touch items-center justify-between gap-3 px-4 py-2">
      <span className="text-body">{label}</span>
      <span className="text-subheadline text-muted">{value}</span>
    </div>
  );
}
