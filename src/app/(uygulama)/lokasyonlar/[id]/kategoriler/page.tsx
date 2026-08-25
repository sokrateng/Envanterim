import { notFound } from "next/navigation";
import { EmptyState, Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import { canManageCategories } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { NewCategoryButton } from "./NewCategoryButton";

export const dynamic = "force-dynamic";

export default async function KategorilerPage({
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
      categories: {
        select: {
          id: true,
          name: true,
          icon: true,
          _count: { select: { items: true, fields: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!location) notFound();

  const canManage = canManageCategories(access);

  return (
    <Screen>
      <ScreenHeader
        title="Kategoriler"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
        action={canManage ? <NewCategoryButton locationId={id} /> : undefined}
      />

      {location.categories.length === 0 ? (
        <EmptyState
          title="Kategori yok"
          description={
            canManage
              ? "Kategori açıp ona özel alanlar tanımlayabilirsin: ekran boyutu, yakıt tipi, şase no…"
              : "Kategori tanımlamayı yalnız lokasyon sahibi yapabilir."
          }
        />
      ) : (
        <Group footer="Kategoriye tanımlanan alanlar ekipman formunda çıkar.">
          <Rows>
            {location.categories.map((category) => (
              <Row
                key={category.id}
                href={canManage ? `/lokasyonlar/${id}/kategoriler/${category.id}` : undefined}
                title={`${category.icon ?? "🏷"} ${category.name}`}
                subtitle={`${category._count.fields} özel alan · ${category._count.items} ekipman`}
              />
            ))}
          </Rows>
        </Group>
      )}
    </Screen>
  );
}
