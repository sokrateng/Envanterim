import { notFound } from "next/navigation";
import { Badge, Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import {
  ITEM_STATUS_LABELS,
  type FieldType,
  type ItemStatus,
} from "@/lib/constants";
import { readCustomFields, type FieldDef } from "@/lib/custom-fields";
import { formatMoney } from "@/lib/money";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { warrantyStatus } from "@/lib/warranty";
import type { CategoryOption } from "@/components/ItemFields";
import { Attachments, type AttachmentView } from "./Attachments";
import { EditItemButton } from "./EditItemButton";
import { StatusPicker } from "./StatusPicker";

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
        select: { id: true, url: true, name: true, kind: true, mimeType: true },
        orderBy: { uploadedAt: "desc" },
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

  const categories = editable
    ? await prisma.category.findMany({
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
      })
    : [];

  const vendors = editable
    ? await prisma.vendor.findMany({
        where: { locationId: item.locationId, isSeller: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

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
    <Screen>
      <ScreenHeader
        title={item.name}
        back={{ href: "/envanter", label: "Envanter" }}
        action={
          editable ? (
            <EditItemButton
              itemId={item.id}
              categories={categoryOptions}
              vendors={vendors}
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
                status: item.status,
                categoryId: item.categoryId ?? "",
                sellerId: item.sellerId ?? "",
                customFields:
                  item.customFields && typeof item.customFields === "object"
                    ? (item.customFields as Record<string, unknown>)
                    : {},
              }}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 px-4 pt-3">
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

      <Group title="Ekipman">
        <Rows>
          {item.category ? (
            <Row
              title="Kategori"
              trailing={`${item.category.icon ?? "🏷"} ${item.category.name}`}
            />
          ) : null}
          {item.brand ? <Row title="Marka" trailing={item.brand} /> : null}
          {item.model ? <Row title="Model" trailing={item.model} /> : null}
          {item.serialNo ? <Row title="Seri no" trailing={item.serialNo} /> : null}
          {item.place ? <Row title="Yer" trailing={item.place} /> : null}
          <Row title="Lokasyon" trailing={item.location.name} />
        </Rows>
      </Group>

      <Group title="Satın alma">
        <Rows>
          <Row
            title="Alış tarihi"
            trailing={item.purchaseDate ? trDate.format(item.purchaseDate) : "—"}
          />
          <Row title="Satıcı" trailing={item.seller?.name ?? "—"} />
          <Row
            title="Alış tutarı"
            trailing={
              item.purchasePriceMinor != null
                ? formatMoney(item.purchasePriceMinor, item.currency)
                : "—"
            }
          />
          <Row
            title="Garanti bitişi"
            trailing={
              item.warrantyEndDate ? trDate.format(item.warrantyEndDate) : "—"
            }
          />
        </Rows>
      </Group>

      {customRows.length ? (
        <Group title={`${item.category?.name ?? "Özel"} alanları`}>
          <Rows>
            {customRows.map((row) => (
              <Row key={row.key} title={row.label} trailing={row.text} />
            ))}
          </Rows>
        </Group>
      ) : null}

      <Attachments
        itemId={item.id}
        editable={editable}
        attachments={item.attachments as AttachmentView[]}
      />

      {editable ? (
        <StatusPicker itemId={item.id} status={item.status as ItemStatus} />
      ) : null}
    </Screen>
  );
}
