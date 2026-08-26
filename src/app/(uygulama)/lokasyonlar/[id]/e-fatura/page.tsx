import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/ui";
import { requireLocationEditor } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { EInvoiceImport } from "./EInvoiceImport";

export const dynamic = "force-dynamic";

export default async function EFaturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocationEditor(id);
  // Görüntüleyen ekipman oluşturamaz; sayfa da açılmasın.
  if (!access || access === "readonly") notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!location) notFound();

  return (
    <Screen>
      <ScreenHeader
        title="e-Fatura"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
      />
      <EInvoiceImport locationId={id} />
    </Screen>
  );
}
