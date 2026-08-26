import { NextResponse } from "next/server";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard, parseBody } from "@/lib/api";
import { LINK_PROBLEM_TEXT, checkLink } from "@/lib/components";
import { prisma } from "@/lib/prisma";
import { componentLinkSchema } from "@/lib/validation";

/**
 * Alt ekipman bağı: bu ekipman kimin bileşeni. Boş değer bağı kaldırır.
 *
 * Bağın kurulabilir olup olmadığına saf modül karar veriyor (döngü, derinlik,
 * lokasyon) — kural tek yerde ve testli.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("bilesen", async () => {
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, locationId: true },
    });
    if (!item) return apiError("Ekipman bulunamadı", 404);

    const access = await requireLocationEditor(item.locationId);
    if (!access) return NOT_MEMBER();
    if (access === "readonly") return READONLY();

    const parsed = await parseBody(request, componentLinkSchema);
    if ("response" in parsed) return parsed.response;
    const { parentId } = parsed.data;

    if (parentId) {
      // Karar ağacın tamamına bakıyor; lokasyonun ekipmanları yeter, bileşen
      // bağı lokasyon dışına çıkamıyor.
      const nodes = await prisma.item.findMany({
        where: { locationId: item.locationId },
        select: { id: true, parentId: true, locationId: true },
      });

      const parent = await prisma.item.findUnique({
        where: { id: parentId },
        select: { id: true, parentId: true, locationId: true },
      });
      if (!parent) return apiError("Ana ekipman bulunamadı", 404);
      if (!nodes.some((node) => node.id === parent.id)) nodes.push(parent);

      const problem = checkLink(nodes, item.id, parentId);
      if (problem) return apiError(LINK_PROBLEM_TEXT[problem], 422);
    }

    const updated = await prisma.item.update({
      where: { id: item.id },
      data: { parentId },
      select: { id: true, parentId: true },
    });

    return NextResponse.json(updated);
  });
}
