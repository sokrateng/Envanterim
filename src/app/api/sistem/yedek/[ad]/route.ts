import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { READONLY, apiError, guard } from "@/lib/api";
import { currentAdmin } from "@/lib/admin";
import { openBackup } from "@/lib/backup-server";

/**
 * Yedek dosyasını indirir. Ad `backup.ts`'teki desenle sınırlı (yol gezintisi
 * yok) ve yalnız sistem yöneticisi indirebilir: dosyada parola özetleri dahil
 * her şey var.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ad: string }> },
) {
  return guard("yedek-indir", async () => {
    const admin = await currentAdmin();
    if (!admin) return READONLY();

    const { ad } = await params;
    const file = await openBackup(ad);
    if (!file) return apiError("Yedek bulunamadı", 404);

    // NextResponse, Response'tan türüyor; guard() yalnız onu kabul ediyor.
    return new NextResponse(Readable.toWeb(file.stream) as ReadableStream, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(file.size),
        "content-disposition": `attachment; filename="${ad}"`,
        "cache-control": "no-store",
      },
    });
  });
}
