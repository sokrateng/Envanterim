import { NextResponse } from "next/server";
import { READONLY, apiError, guard } from "@/lib/api";
import { currentAdmin } from "@/lib/admin";
import { backupSummary, runBackup } from "@/lib/backup-server";

/**
 * Yedek özeti ve "şimdi yedekle". Yalnız sistem yöneticisi: yedek, bütün
 * lokasyonların ve bütün hesapların verisidir — lokasyon üyeliği yetmez.
 */
export async function GET() {
  return guard("yedek-ozet", async () => {
    const admin = await currentAdmin();
    if (!admin) return READONLY();
    return NextResponse.json(await backupSummary());
  });
}

export async function POST() {
  return guard("yedek-al", async () => {
    const admin = await currentAdmin();
    if (!admin) return READONLY();

    const result = await runBackup();
    if (!result.ok) return apiError(result.message, 409);
    return NextResponse.json(await backupSummary());
  });
}
