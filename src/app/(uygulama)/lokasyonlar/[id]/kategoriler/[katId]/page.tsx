import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/constants";
import { canManageCategories } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CategoryFields, type FieldView } from "./CategoryFields";
import { EditCategory } from "./EditCategory";

export const dynamic = "force-dynamic";

export default async function KategoriPage({
  params,
}: {
  params: Promise<{ id: string; katId: string }>;
}) {
  const { id, katId } = await params;
  const access = await requireLocation(id);
  if (!access || !canManageCategories(access)) notFound();

  const category = await prisma.category.findFirst({
    where: { id: katId, locationId: id },
    select: {
      name: true,
      icon: true,
      _count: { select: { items: true } },
      fields: {
        select: {
          id: true,
          key: true,
          label: true,
          type: true,
          required: true,
          hidden: true,
          options: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!category) notFound();

  const fields: FieldView[] = category.fields.map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    typeLabel: FIELD_TYPE_LABELS[field.type as FieldType] ?? field.type,
    required: field.required,
    hidden: field.hidden,
    options: Array.isArray(field.options) ? (field.options as string[]) : [],
  }));

  return (
    <Screen>
      <ScreenHeader
        title={`${category.icon ?? "🏷"} ${category.name}`}
        back={{ href: `/lokasyonlar/${id}/kategoriler`, label: "Kategoriler" }}
        action={
          <EditCategory
            locationId={id}
            categoryId={katId}
            name={category.name}
            icon={category.icon}
          />
        }
      />
      <p className="px-4 pt-2 text-footnote text-muted">
        {category._count.items} ekipman bu kategoride.
      </p>
      <CategoryFields locationId={id} categoryId={katId} fields={fields} />
    </Screen>
  );
}
