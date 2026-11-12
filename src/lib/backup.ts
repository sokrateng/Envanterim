import { z } from "zod";

/**
 * Yedek ekranının saf mantığı: dosya adı tanıma, durum dosyası okuma, sağlık
 * kararı, boyut yazımı. Dosya sistemine dokunmaz (bkz. backup-server.ts), bu
 * yüzden testli.
 */

// deploy/pi/backup.sh'in ürettiği adlar. İndirme ucu da bu desenle sınırlı:
// adres yol gezintisine (../) kapalı kalsın.
const DB_NAME = /^envanterim-\d{8}-\d{6}\.db$/;
const FILES_NAME = /^dosyalar-\d{8}-\d{6}\.tar\.gz$/;

export type BackupKind = "db" | "files";

export function backupKind(name: string): BackupKind | null {
  if (DB_NAME.test(name)) return "db";
  if (FILES_NAME.test(name)) return "files";
  return null;
}

export function isBackupName(name: string): boolean {
  return backupKind(name) !== null;
}

export type BackupFile = {
  name: string;
  size: number;
  /** Değişme zamanı, ms (epoch). */
  modifiedAt: number;
  kind: BackupKind;
};

/** Yedek olmayan dosyaları (günlük, durum, geçici) eler; yeniden eskiye sıralar. */
export function toBackupFiles(
  entries: ReadonlyArray<{ name: string; size: number; modifiedAt: number }>,
): BackupFile[] {
  return entries
    .flatMap((entry) => {
      const kind = backupKind(entry.name);
      return kind ? [{ ...entry, kind }] : [];
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

// backup.sh'in yazdığı durum dosyası. Bozuksa ya da yoksa ekran dosya
// zamanlarından türetilmiş bilgiyle çalışmaya devam eder.
const statusSchema = z.object({
  state: z.enum(["ok", "error"]),
  finishedAt: z.string(),
  message: z.string().optional(),
  db: z.string().nullable().optional(),
  dbSize: z.number().nullable().optional(),
});

export type BackupStatus = z.infer<typeof statusSchema>;

export function parseBackupStatus(raw: string): BackupStatus | null {
  try {
    const parsed = statusSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type BackupHealth = "ok" | "stale" | "error" | "none";

export type HealthReport = { health: BackupHealth; message: string };

/** Bu süreden eski son yedek "gecikmiş" sayılır (haftalık yedek + 1 gün pay). */
export const STALE_AFTER_HOURS = 8 * 24;

export function backupHealth(
  status: BackupStatus | null,
  files: readonly BackupFile[],
  now: number,
): HealthReport {
  const newestDb = files.find((file) => file.kind === "db");

  // Son çalışma hata verdiyse eski bir başarılı yedek olması bunu örtmesin.
  if (status?.state === "error") {
    return {
      health: "error",
      message: status.message ?? "Son yedek alınamadı.",
    };
  }
  if (!newestDb) {
    return {
      health: "none",
      message: "Henüz yedek yok. “Şimdi yedekle” ile ilkini al.",
    };
  }

  const ageHours = (now - newestDb.modifiedAt) / 3_600_000;
  if (ageHours > STALE_AFTER_HOURS) {
    return {
      health: "stale",
      message: `Son yedek ${Math.floor(ageHours / 24)} gün önce. Zamanlanmış görev çalışmıyor olabilir.`,
    };
  }
  return { health: "ok", message: "Yedekler güncel." };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0).replace(".", ",")} ${units[unit]}`;
}
