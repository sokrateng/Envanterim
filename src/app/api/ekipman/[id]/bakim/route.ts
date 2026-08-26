import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, parseBody } from "@/lib/api";
import { maintenanceRuleSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, locationId: true },
  });
  if (!item) return apiError("Ekipman bulunamadı", 404);

  const access = await requireLocationEditor(item.locationId);
  if (!access) return NOT_MEMBER();
  if (access === "readonly") return READONLY();

  const parsed = await parseBody(request, maintenanceRuleSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const rule = await prisma.maintenanceRule.create({
    data: {
      itemId: item.id,
      name: data.name,
      everyMonths: data.everyMonths ?? null,
      everyReading: data.everyReading ?? null,
      readingUnit: data.readingUnit ?? null,
      leadDays: data.leadDays,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(rule, { status: 201 });
}
