import { NextResponse } from "next/server";
import { z } from "zod";
import { UNAUTHENTICATED, guard, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

const bodySchema = z.object({
  yeniEkipman: z.coerce.boolean().optional(),
  degisiklik: z.coerce.boolean().optional(),
});

/**
 * Envanter olayı bildirim tercihleri. Kanaldan bağımsız: kapalıysa ne push ne
 * e-posta gider. Yalnız gönderilen alan değişiyor — iki anahtar tek istekte
 * gitmiyor, biri diğerini sıfırlamasın.
 */
export async function PATCH(request: Request) {
  return guard("bildirim-tercihi", async () => {
    const user = await currentUser();
    if (!user) return UNAUTHENTICATED();

    const parsed = await parseBody(request, bodySchema);
    if ("response" in parsed) return parsed.response;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.yeniEkipman === undefined
          ? {}
          : { notifyNewItem: parsed.data.yeniEkipman }),
        ...(parsed.data.degisiklik === undefined
          ? {}
          : { notifyItemChange: parsed.data.degisiklik }),
      },
      select: { notifyNewItem: true, notifyItemChange: true },
    });

    return NextResponse.json({
      yeniEkipman: updated.notifyNewItem,
      degisiklik: updated.notifyItemChange,
    });
  });
}
