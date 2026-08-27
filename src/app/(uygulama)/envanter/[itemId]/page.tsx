import { notFound } from "next/navigation";
import { Group, Row, Rows, Screen } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import {
  type FieldType,
  type ItemStatus,
} from "@/lib/constants";
import { readCustomFields, type FieldDef } from "@/lib/custom-fields";
import { formatMoney } from "@/lib/money";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ownershipCostMinor, type TimelineEvent } from "@/lib/events";
import { ruleStatus, statusText } from "@/lib/maintenance";
import { remainingText, shareState } from "@/lib/share";
import { isExtractionConfigured } from "@/lib/invoice-extract";
import { warrantyStatus } from "@/lib/warranty";
import type { CategoryOption } from "@/components/ItemFields";
import {
  activeAssignment,
  assignmentState,
  canRespond,
  holderView,
  isOverdue,
  isSelf,
  pendingDays,
} from "@/lib/assignment";
import { linkableChildren, totalWithComponents } from "@/lib/components";
import { listVendorsByRole } from "@/lib/vendors";
import { Assignment, type AssignmentView } from "./Assignment";
import { Components, type ComponentRow } from "./Components";
import { Attachments, type AttachmentView } from "./Attachments";
import { Parts, type PartRow } from "./Parts";
import { Maintenance, type MaintenanceRow } from "./Maintenance";
import { ShareLinks, type ShareRow } from "./ShareLinks";
import { Timeline, type TimelineRow } from "./Timeline";
import { FillProvider } from "./fill-context";
import { EditItemButton } from "./EditItemButton";
import { StatusPicker } from "./StatusPicker";
import { Notes, type NoteView } from "./Notes";
import { Service, type ServiceRow } from "./Service";
import { Rating } from "./Rating";
import { Hero } from "./Hero";
import { canDeleteNote, canEditNote } from "@/lib/notes";
import { averageStars } from "@/lib/rating";
import { paymentLabel, serviceLabel, serviceState } from "@/lib/service";
import { titleClass } from "@/lib/typography";

export const dynamic = "force-dynamic";

const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Tarih girdisi "YYYY-MM-DD" bekler; yerel gün kayması olmasın. */
function toInputDate(date: Date | null): string {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default async function EkipmanPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      locationId: true,
      categoryId: true,
      name: true,
      brand: true,
      model: true,
      serialNo: true,
      place: true,
      status: true,
      purchaseDate: true,
      purchasePriceMinor: true,
      currency: true,
      sellerId: true,
      seller: { select: { name: true } },
      warrantyEndDate: true,
      customFields: true,
      attachments: {
        select: { id: true, url: true, name: true, kind: true, mimeType: true, noteId: true },
        orderBy: { uploadedAt: "desc" },
      },
      notes: {
        select: {
          id: true,
          body: true,
          authorName: true,
          userId: true,
          createdAt: true,
          attachments: { select: { id: true, url: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      ratings: { select: { userId: true, stars: true } },
      favorites: { select: { userId: true } },
      serviceJobs: {
        select: {
          id: true,
          complaint: true,
          sentAt: true,
          trackingNo: true,
          trackingUrl: true,
          vendorId: true,
          returnedAt: true,
          work: true,
          costMinor: true,
          paid: true,
          underWarranty: true,
          // Servisteki ekipmanın sahibi "ne oldu" diye arayacak: telefon ve
          // web sayfası kaydın yanında dursun.
          vendor: { select: { name: true, phone: true, website: true } },
        },
        orderBy: { sentAt: "desc" },
      },
      shareLinks: {
        select: {
          id: true,
          token: true,
          expiresAt: true,
          revokedAt: true,
          viewCount: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      maintenance: {
        select: {
          id: true,
          name: true,
          everyMonths: true,
          everyReading: true,
          readingUnit: true,
          leadDays: true,
        },
        orderBy: { createdAt: "asc" },
      },
      parts: {
        select: {
          id: true,
          name: true,
          partNo: true,
          priceMinor: true,
          stock: true,
          vendor: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      },
      events: {
        select: {
          id: true,
          kind: true,
          date: true,
          note: true,
          costMinor: true,
          readingValue: true,
          readingUnit: true,
          vendor: { select: { name: true } },
          assignedToUser: { select: { name: true } },
          assignedPlace: true,
        },
        orderBy: { date: "desc" },
      },
      parentId: true,
      parent: { select: { id: true, name: true } },
      components: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          status: true,
          purchasePriceMinor: true,
          parts: { select: { priceMinor: true } },
          events: { select: { kind: true, costMinor: true } },
        },
        orderBy: { name: "asc" },
      },
      assignments: {
        select: {
          id: true,
          holderUserId: true,
          holderName: true,
          assignedAt: true,
          acceptedAt: true,
          closedAt: true,
          closedReason: true,
          note: true,
          holderUser: { select: { name: true } },
          assignedBy: { select: { name: true } },
        },
        orderBy: { assignedAt: "desc" },
        take: 20,
      },
      location: { select: { id: true, name: true } },
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
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
    },
  });
  if (!item) notFound();

  // Üye olmayana ekipmanın varlığı bile sızmasın.
  const access = await requireLocation(item.locationId);
  if (!access) notFound();
  const editable = canEdit(access);

  // Başlıktaki küçük görsel: ekipmanın ilk fotoğrafı. Nota eklenen fotoğraflar
  // notun içinde çıkıyor; genel ekler bölümüne ve başlığa karışmıyorlar.
  const ownAttachments = item.attachments.filter((file) => !file.noteId);
  const photo = ownAttachments.find((file) => file.kind === "PHOTO") ?? null;

  const notes: NoteView[] = item.notes.map((note) => ({
    id: note.id,
    body: note.body,
    authorName: note.authorName,
    createdAt: trDate.format(note.createdAt),
    canEdit: canEditNote(note, access),
    canDelete: canDeleteNote(note, access),
    photos: note.attachments,
  }));

  const myRating =
    item.ratings.find((rating) => rating.userId === access.userId)?.stars ?? null;
  const favorite = item.favorites.some((mark) => mark.userId === access.userId);
  const average = averageStars(item.ratings.map((rating) => rating.stars));

  const serviceJobs: ServiceRow[] = item.serviceJobs.map((job) => ({
    id: job.id,
    vendorName: job.vendor?.name ?? null,
    vendorPhone: job.vendor?.phone ?? null,
    vendorWebsite: job.vendor?.website ?? null,
    trackingUrl: job.trackingUrl,
    // Düzenleme formu biçimlenmiş metni değil ham değeri istiyor.
    form: {
      complaint: job.complaint,
      vendorId: job.vendorId ?? "",
      sentAt: toInputDate(job.sentAt),
      trackingNo: job.trackingNo ?? "",
      trackingUrl: job.trackingUrl ?? "",
      returnedAt: toInputDate(job.returnedAt),
      work: job.work ?? "",
      cost:
        job.costMinor != null
          ? formatMoney(job.costMinor, item.currency).replace(/\s\D+$/, "")
          : "",
      paid: job.paid,
      underWarranty: job.underWarranty,
    },
    complaint: job.complaint,
    sentAt: trDate.format(job.sentAt),
    trackingNo: job.trackingNo,
    returnedAt: job.returnedAt ? trDate.format(job.returnedAt) : null,
    work: job.work,
    cost:
      job.costMinor != null ? formatMoney(job.costMinor, item.currency) : null,
    durum: serviceLabel(job),
    odeme: paymentLabel(job),
    open: serviceState(job) === "open",
  }));

  const fieldDefs: FieldDef[] = (item.category?.fields ?? []).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type as FieldType,
    required: field.required,
    options: Array.isArray(field.options) ? (field.options as string[]) : null,
    hidden: field.hidden,
  }));
  const customRows = readCustomFields(item.customFields, fieldDefs);
  const warranty = warrantyStatus(item.warrantyEndDate);

  const timeline: TimelineRow[] = item.events.map((event) => ({
    id: event.id,
    kind: event.kind as TimelineEvent["kind"],
    date: event.date.toISOString(),
    note: event.note,
    costMinor: event.costMinor,
    readingValue: event.readingValue,
    readingUnit: event.readingUnit,
    vendorName: event.vendor?.name ?? null,
    assignedToName: event.assignedToUser?.name ?? null,
    assignedPlace: event.assignedPlace,
  }));

  // Bakım durumu sunucuda hesaplanıyor: kayıtlar zaten burada, istemciye
  // yalnız sonuç gidiyor.
  const maintenanceEvents = item.events.map((event) => ({
    kind: event.kind as TimelineEvent["kind"],
    date: event.date,
    readingValue: event.readingValue,
  }));

  const maintenanceRows: MaintenanceRow[] = item.maintenance.map((rule) => {
    const status = ruleStatus(rule, {
      events: maintenanceEvents,
      purchaseDate: item.purchaseDate,
    });
    return {
      id: rule.id,
      name: rule.name,
      state: status.state,
      text: statusText(rule, status),
      every: rule.everyReading
        ? `Her ${rule.everyReading.toLocaleString("tr-TR")}${rule.readingUnit ? ` ${rule.readingUnit}` : ""}`
        : `${rule.everyMonths} ayda bir`,
    };
  });

  const shares: ShareRow[] = item.shareLinks.map((link) => ({
    id: link.id,
    token: link.token,
    state: shareState(link),
    remaining: remainingText(link),
    viewCount: link.viewCount,
  }));

  const parts: PartRow[] = item.parts.map((part) => ({
    id: part.id,
    name: part.name,
    partNo: part.partNo,
    priceMinor: part.priceMinor,
    stock: part.stock,
    vendorName: part.vendor?.name ?? null,
  }));

  // Türetilmiş değer saklanmıyor, hesaplanıyor (CLAUDE.md).
  const totalCost = ownershipCostMinor(
    item.purchasePriceMinor,
    item.events.map((event) => ({
      kind: event.kind as TimelineEvent["kind"],
      costMinor: event.costMinor,
    })),
    item.parts.map((part) => part.priceMinor),
    // Garanti kapsamındaki servis toplama girmiyor (src/lib/service.ts).
    item.serviceJobs.map((job) => (job.underWarranty ? null : job.costMinor)),
  );

  // Zimmet: durum kayıttan türetiliyor, saklanmıyor (CLAUDE.md).
  const active = activeAssignment(item.assignments);
  const activeView: AssignmentView | null = active
    ? {
        id: active.id,
        state: assignmentState(active),
        holderName: holderView(active, active.holderUser?.name).name,
        assignedByName: active.assignedBy.name,
        assignedOn: trDate.format(active.assignedAt),
        pendingDays: pendingDays(active),
        overdue: isOverdue(active),
        note: active.note,
        canRespond: canRespond(active, { userId: access.userId, role: access.role }),
        self: isSelf(active, { userId: access.userId, role: access.role }),
      }
    : null;

  // Bileşenlerle birlikte maliyet: lokasyon toplamında her ekipman kendi
  // satırında sayıldığı için bu toplam yalnız bu sayfada anlamlı.
  const componentCosts = item.components.map((component) =>
    ownershipCostMinor(
      component.purchasePriceMinor,
      component.events.map((event) => ({
        kind: event.kind as TimelineEvent["kind"],
        costMinor: event.costMinor,
      })),
      component.parts.map((part) => part.priceMinor),
    ),
  );

  const componentRows: ComponentRow[] = item.components.map((component, index) => ({
    id: component.id,
    name: component.name,
    detail:
      [component.brand, component.model].filter(Boolean).join(" ") ||
      (componentCosts[index] ? formatMoney(componentCosts[index], item.currency) : null),
  }));

  // Dördü de birbirinden bağımsız: sırayla beklemek uzak bölgedeki
  // veritabanında dört ayrı tur demek, birlikte tek tur.
  const [locationItems, members, categories, firmalar] = editable
    ? await Promise.all([
        // Bağlanabilecek ekipmanlar: kural saf modülde (döngü, derinlik,
        // lokasyon), bu yüzden ağacın tamamı gerekiyor — üç küçük sütun.
        prisma.item.findMany({
          where: { locationId: item.locationId },
          select: { id: true, parentId: true, locationId: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.locationMember.findMany({
          where: { locationId: item.locationId },
          select: { user: { select: { id: true, name: true } } },
          orderBy: { user: { name: "asc" } },
        }),
        prisma.category.findMany({
          where: { locationId: item.locationId },
          select: {
            id: true,
            name: true,
            icon: true,
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
        }),
        // Satıcı ve yetkili servis ayrı listeler ve lokasyondan bağımsız
        // (src/lib/vendors.ts): aldığın yerle tamir ettiğin yer aynı değil.
        listVendorsByRole(access.userId),
      ])
    : [[], [], [], { sellers: [], services: [] }];

  const linkable = editable ? linkableChildren(locationItems, item.id) : [];

  const categoryOptions: CategoryOption[] = categories.map((category) => ({
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
  }));

  return (
    <FillProvider>
    <Screen>
      <Hero
        itemId={item.id}
        name={item.name}
        photoUrl={photo?.url ?? null}
        icon={item.category?.icon ?? null}
        editable={editable}
        favorite={favorite}
      />

      {/* Ad uzadıkça punto küçülüyor (src/lib/typography.ts) ama alan sabit
          değil: iki satırlık kutu kısa adlarda yıldızlarla arasında boş bir
          şerit bırakıyordu. Kırpma zaten iki satırı geçmesini engelliyor. */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <h1 className={`min-w-0 break-words ${titleClass(item.name)}`}>
          {item.name}
        </h1>
        {editable ? (
          <EditItemButton
            itemId={item.id}
            categories={categoryOptions}
            vendors={firmalar.sellers}
            defaults={{
              name: item.name,
              brand: item.brand ?? "",
              model: item.model ?? "",
              serialNo: item.serialNo ?? "",
              place: item.place ?? "",
              purchaseDate: toInputDate(item.purchaseDate),
              warrantyEndDate: toInputDate(item.warrantyEndDate),
              purchasePrice:
                item.purchasePriceMinor != null
                  ? formatMoney(item.purchasePriceMinor, item.currency).replace(
                      /\s\D+$/,
                      "",
                    )
                  : "",
              currency: item.currency,
              status: item.status,
              categoryId: item.categoryId ?? "",
              sellerId: item.sellerId ?? "",
              customFields:
                item.customFields && typeof item.customFields === "object"
                  ? (item.customFields as Record<string, unknown>)
                  : {},
            }}
          />
        ) : null}
      </div>

      <Rating
        itemId={item.id}
        mine={myRating}
        count={item.ratings.length}
        average={average}
        canRate
      />

      <Group title="Ekipman">
        <Rows>
          {item.category ? (
            <Row
              title="Kategori"
              value={`${item.category.icon ?? "🏷"} ${item.category.name}`}
            />
          ) : null}
          {item.brand ? <Row title="Marka" value={item.brand} /> : null}
          {item.model ? <Row title="Model" value={item.model} /> : null}
          {item.serialNo ? <Row title="Seri no" value={item.serialNo} /> : null}
          {item.place ? <Row title="Yer" value={item.place} /> : null}
          <Row title="Lokasyon" value={item.location.name} />
          <Row
            href={`/envanter/${item.id}/etiket`}
            title="QR etiket"
            subtitle="Yazdır, cihazın üstüne yapıştır"
          />
        </Rows>
      </Group>

      <Group title="Satın alma">
        <Rows>
          <Row
            title="Alış tarihi"
            value={item.purchaseDate ? trDate.format(item.purchaseDate) : "—"}
          />
          <Row title="Satıcı" value={item.seller?.name ?? "—"} />
          <Row
            title="Alış tutarı"
            value={
              item.purchasePriceMinor != null
                ? formatMoney(item.purchasePriceMinor, item.currency)
                : "—"
            }
          />
          <Row
            title="Sahip olma maliyeti"
            subtitle="Alış + servis + parça"
            value={formatMoney(totalCost, item.currency)}
          />
          {componentCosts.some((cost) => cost > 0) ? (
            <Row
              title="Bileşenlerle birlikte"
              subtitle={`${componentCosts.length} bileşen dahil`}
              value={formatMoney(
                totalWithComponents(totalCost, componentCosts),
                item.currency,
              )}
            />
          ) : null}
          {/* Kalan gün tarihin altında ve renkli: rozet şeridi kalkınca
              garantinin durumu sayfada hiçbir yerde görünmüyordu. */}
          <Row
            title="Garanti bitişi"
            value={
              <>
                <span className="block">
                  {item.warrantyEndDate
                    ? trDate.format(item.warrantyEndDate)
                    : "—"}
                </span>
                <span
                  className={`block text-caption ${
                    warranty.state === "active"
                      ? "text-green"
                      : warranty.state === "ending-soon"
                        ? "text-orange"
                        : "text-muted"
                  }`}
                >
                  {warranty.label}
                </span>
              </>
            }
          />
        </Rows>
      </Group>

      {customRows.length ? (
        <Group title={`${item.category?.name ?? "Özel"} alanları`}>
          <Rows>
            {customRows.map((row) => (
              <Row key={row.key} title={row.label} value={row.text} />
            ))}
          </Rows>
        </Group>
      ) : null}

      {editable ? (
        <StatusPicker itemId={item.id} status={item.status as ItemStatus} />
      ) : null}

      {/* Yedi bölüm alt alta açıkken sayfa metrelerce uzuyordu; tek kartta
          katlanır satırlar (docs/TASARIM.md). Sıra tasarımdaki sıra. */}
      <Group title="Kayıtlar">
        <Rows>
          <Service
            itemId={item.id}
            jobs={serviceJobs}
            vendors={firmalar.services}
            editable={editable}
          />
          <Assignment
            itemId={item.id}
            active={activeView}
            members={members.map((member) => member.user)}
            componentCount={item.components.length}
            editable={editable}
          />
          <Notes itemId={item.id} notes={notes} canWrite />
          {item.parent || componentRows.length || (editable && linkable.length) ? (
            <Components
              itemId={item.id}
              parent={item.parent}
              components={componentRows}
              linkable={linkable.map((option) => ({
                id: option.id,
                name: option.name,
              }))}
              editable={editable}
            />
          ) : null}
          <Maintenance
            itemId={item.id}
            rules={maintenanceRows}
            editable={editable}
          />
          <Parts
            itemId={item.id}
            parts={parts}
            vendors={firmalar.sellers}
            currency={item.currency}
            editable={editable}
          />
          <Attachments
            itemId={item.id}
            editable={editable}
            extractionEnabled={isExtractionConfigured()}
            attachments={ownAttachments as AttachmentView[]}
          />
          <ShareLinks itemId={item.id} links={shares} editable={editable} />
          <Timeline
            itemId={item.id}
            events={timeline}
            vendors={firmalar.services}
            members={members.map((member) => member.user)}
            currency={item.currency}
            editable={editable}
          />
        </Rows>
      </Group>



    </Screen>
    </FillProvider>
  );
}
