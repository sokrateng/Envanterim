import { NextResponse } from "next/server";
import { requireLocationEditor } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard, parseBody } from "@/lib/api";
import { activeAssignment, eventNote, holderView } from "@/lib/assignment";
import { notifyAssigned } from "@/lib/assignment-notify";
import { prisma } from "@/lib/prisma";
import { assignmentCreateSchema } from "@/lib/validation";

/**
 * Zimmet verme ve devir. Devir ayrı bir uç değil: açık zimmet varken yeni
 * zimmet açmak devirdir — eskisi "devredildi" diye kapanır.
 *
 * Bileşenler ana ekipmanla birlikte gider (kullanıcı isterse kutuyu kaldırır):
 * telefonu devrederken lisansı elde kalmasın.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guard("zimmet", async () => {
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        locationId: true,
        components: { select: { id: true, name: true } },
      },
    });
    // Üye olmayan için "yok" ile "yetkisiz" aynı yanıt.
    if (!item) return apiError("Ekipman bulunamadı", 404);

    const access = await requireLocationEditor(item.locationId);
    if (!access) return NOT_MEMBER();
    if (access === "readonly") return READONLY();

    const parsed = await parseBody(request, assignmentCreateSchema);
    if ("response" in parsed) return parsed.response;
    const { holderUserId, holderName, note, withComponents } = parsed.data;

    // Hesabı olan biri ancak o lokasyonun üyesiyse zimmet alabilir: göremediği
    // ekipmanı üzerine alamaz.
    let holder: { id: string; name: string } | null = null;
    if (holderUserId) {
      const member = await prisma.locationMember.findUnique({
        where: {
          locationId_userId: {
            locationId: item.locationId,
            userId: holderUserId,
          },
        },
        select: { user: { select: { id: true, name: true } } },
      });
      if (!member) return apiError("Bu kişi lokasyonun üyesi değil", 422);
      holder = member.user;
    }

    const targets = withComponents ? [item, ...item.components] : [item];
    const assignedAt = new Date();
    const created: string[] = [];

    for (const target of targets) {
      const open = activeAssignment(
        await prisma.itemAssignment.findMany({
          where: { itemId: target.id, closedAt: null },
          select: {
            id: true,
            holderUserId: true,
            holderName: true,
            assignedAt: true,
            acceptedAt: true,
            closedAt: true,
            closedReason: true,
            holderUser: { select: { name: true } },
          },
        }),
      );

      // Zaten aynı kişideyse dokunma: devir diye ikinci kayıt açmak geçmişi
      // gürültüye boğar.
      if (
        open &&
        open.holderUserId === (holderUserId ?? null) &&
        open.holderName === (holderName ?? null)
      ) {
        continue;
      }

      if (open) {
        await prisma.itemAssignment.update({
          where: { id: open.id },
          data: {
            closedAt: assignedAt,
            closedReason: "TRANSFER",
            closedById: access.userId,
          },
        });
      }

      const assignment = await prisma.itemAssignment.create({
        data: {
          itemId: target.id,
          holderUserId: holder?.id ?? null,
          holderName: holder ? null : (holderName ?? null),
          assignedById: access.userId,
          assignedAt,
          note: note ?? null,
        },
        select: { id: true },
      });
      created.push(assignment.id);

      // Teslim–tesellüm izi zaman çizelgesinde de dursun.
      await prisma.itemEvent.create({
        data: {
          itemId: target.id,
          date: assignedAt,
          kind: "ASSIGNMENT",
          assignedToUserId: holder?.id ?? null,
          note: eventNote(
            {
              userId: holder?.id ?? null,
              name: holder?.name ?? (holderName as string),
              hasAccount: Boolean(holder),
            },
            open
              ? `Devir · önceki: ${holderView(open, open.holderUser?.name).name}`
              : "Zimmet verildi",
          ),
        },
      });
    }

    const assigner = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { name: true },
    });

    // Bildirim yalnız hesabı olan kişiye gidebilir; hesapsız kişinin teslimini
    // sahibi elle işaretliyor. Gönderim await ediliyor (TUZAKLAR #1).
    if (holder && created.length) {
      await notifyAssigned(item, holder.id, assigner?.name ?? "Bir üye");
    }

    return NextResponse.json(
      { zimmet: created.length, bilesen: Math.max(0, created.length - 1) },
      { status: 201 },
    );
  });
}
