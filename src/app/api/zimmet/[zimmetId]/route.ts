import { NextResponse } from "next/server";
import { getLocationAccess } from "@/lib/access";
import {
  NOT_MEMBER,
  READONLY,
  UNAUTHENTICATED,
  apiError,
  guard,
  parseBody,
} from "@/lib/api";
import { canRespond, eventNote, holderView, isSelf } from "@/lib/assignment";
import { notifyAnswer } from "@/lib/assignment-notify";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { assignmentActionSchema } from "@/lib/validation";

/**
 * Teslim–tesellüm cevabı: kabul, red ya da iade.
 *
 * Kabulü kişinin kendisi verir; hesabı olmayan (ya da uygulamaya girmeyen)
 * biri için sahibi/düzenleyen "elden teslim edildi" diye işaretler. Kimin
 * işaretlediği `acceptedById`/`closedById` ile kayıtta duruyor — teslim izinin
 * kıymeti bu.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ zimmetId: string }> },
) {
  return guard("zimmet-cevap", async () => {
    const { zimmetId } = await params;
    const user = await currentUser();
    if (!user) return UNAUTHENTICATED();

    const assignment = await prisma.itemAssignment.findUnique({
      where: { id: zimmetId },
      select: {
        id: true,
        itemId: true,
        holderUserId: true,
        holderName: true,
        assignedById: true,
        assignedAt: true,
        acceptedAt: true,
        closedAt: true,
        closedReason: true,
        holderUser: { select: { name: true } },
        item: { select: { id: true, name: true, locationId: true } },
      },
    });
    if (!assignment) return apiError("Zimmet bulunamadı", 404);

    const access = await getLocationAccess(assignment.item.locationId);
    if (!access) return NOT_MEMBER();

    const parsed = await parseBody(request, assignmentActionSchema);
    if ("response" in parsed) return parsed.response;
    const { islem } = parsed.data;

    const viewer = { userId: user.id, role: access.role };
    if (!canRespond(assignment, viewer)) return READONLY();
    if (islem === "IADE" && !assignment.acceptedAt) {
      return apiError("Üzerine alınmamış zimmet iade edilemez", 409);
    }

    const now = new Date();
    const holder = holderView(assignment, assignment.holderUser?.name);
    const kendisi = isSelf(assignment, viewer);

    if (islem === "KABUL") {
      await prisma.itemAssignment.update({
        where: { id: assignment.id },
        data: { acceptedAt: now, acceptedById: user.id },
      });
      await logEvent(
        assignment.itemId,
        assignment.holderUserId,
        now,
        eventNote(holder, "Teslim alındı", kendisi ? null : user.name),
      );
    } else {
      await prisma.itemAssignment.update({
        where: { id: assignment.id },
        data: {
          closedAt: now,
          closedReason: islem === "RED" ? "DECLINE" : "RETURN",
          closedById: user.id,
        },
      });
      await logEvent(
        assignment.itemId,
        assignment.holderUserId,
        now,
        eventNote(
          holder,
          islem === "RED" ? "Kabul edilmedi" : "İade edildi",
          kendisi ? null : user.name,
        ),
      );
    }

    // Cevabı atayan görsün — kendi işaretlediyse kendine bildirim gitmesin.
    if (islem !== "IADE" && assignment.assignedById !== user.id) {
      await notifyAnswer(
        assignment.item,
        assignment.assignedById,
        holder.name,
        islem === "KABUL",
      );
    }

    return NextResponse.json({ islem });
  });
}

/** Zaman çizelgesine iz bırakır. Not metni saf modülden geliyor. */
async function logEvent(
  itemId: string,
  holderUserId: string | null,
  date: Date,
  note: string,
) {
  await prisma.itemEvent.create({
    data: {
      itemId,
      date,
      kind: "ASSIGNMENT",
      assignedToUserId: holderUserId,
      note,
    },
  });
}
