import { NextResponse } from "next/server";
import { z } from "zod";
import { getLocationAccess } from "@/lib/access";
import { NOT_MEMBER, READONLY, apiError, guard, parseBody } from "@/lib/api";
import { NOTE_MAX, canDeleteNote, canEditNote } from "@/lib/notes";
import { prisma } from "@/lib/prisma";
import { removeFile } from "@/lib/storage";

const bodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Not boş olamaz")
    .max(NOTE_MAX, `Not en çok ${NOTE_MAX} karakter olabilir`),
});

/** Notu yalnız yazarı düzenler; kim silebilir kuralı saf modülde. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notId: string }> },
) {
  return guard("not-duzenle", async () => {
    const { notId } = await params;

    const note = await prisma.itemNote.findUnique({
      where: { id: notId },
      select: { id: true, userId: true, item: { select: { locationId: true } } },
    });
    if (!note) return apiError("Not bulunamadı", 404);

    const access = await getLocationAccess(note.item.locationId);
    if (!access) return NOT_MEMBER();
    if (!canEditNote(note, access)) return READONLY();

    const parsed = await parseBody(request, bodySchema);
    if ("response" in parsed) return parsed.response;

    await prisma.itemNote.update({
      where: { id: note.id },
      data: { body: parsed.data.body },
    });

    return NextResponse.json({ id: note.id });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ notId: string }> },
) {
  return guard("not-sil", async () => {
    const { notId } = await params;

    const note = await prisma.itemNote.findUnique({
      where: { id: notId },
      select: {
        id: true,
        userId: true,
        attachments: { select: { path: true } },
        item: { select: { locationId: true } },
      },
    });
    if (!note) return apiError("Not bulunamadı", 404);

    const access = await getLocationAccess(note.item.locationId);
    if (!access) return NOT_MEMBER();
    if (!canDeleteNote(note, access)) return READONLY();

    // Önce depodaki dosyalar: kayıt gidip dosya kalırsa kimse bulamaz.
    for (const file of note.attachments) await removeFile(file.path);
    await prisma.itemNote.delete({ where: { id: note.id } });

    return NextResponse.json({ silindi: true });
  });
}
