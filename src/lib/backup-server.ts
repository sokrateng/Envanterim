import "server-only";

import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  type BackupFile,
  type BackupStatus,
  backupHealth,
  isBackupName,
  parseBackupStatus,
  toBackupFiles,
  type HealthReport,
} from "@/lib/backup";

const run = promisify(execFile);

/**
 * Yedeklerin durduğu klasör. `deploy/pi/backup.sh` aynı klasöre yazıyor
 * (OUT_DIR); ikisi aynı yeri göstermek zorunda, o yüzden betiğe de buradan
 * veriliyor.
 */
export function backupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(os.homedir(), "envanterim-yedek");
}

function scriptPath(): string {
  return path.join(process.cwd(), "deploy", "pi", "backup.sh");
}

export async function isBackupScriptAvailable(): Promise<boolean> {
  try {
    await access(scriptPath());
    return true;
  } catch {
    return false;
  }
}

export async function listBackups(): Promise<BackupFile[]> {
  let names: string[];
  try {
    names = await readdir(backupDir());
  } catch {
    // Klasör henüz yoksa: hiç yedek alınmamış demek, hata değil.
    return [];
  }

  const entries = await Promise.all(
    names.filter(isBackupName).map(async (name) => {
      const info = await stat(path.join(backupDir(), name));
      return { name, size: info.size, modifiedAt: info.mtimeMs };
    }),
  );
  return toBackupFiles(entries);
}

export async function readBackupStatus(): Promise<BackupStatus | null> {
  try {
    const raw = await readFile(path.join(backupDir(), "durum.json"), "utf8");
    return parseBackupStatus(raw);
  } catch {
    return null;
  }
}

export type BackupSummary = {
  files: BackupFile[];
  status: BackupStatus | null;
  report: HealthReport;
  /** "Şimdi yedekle" bu makinede çalışabilir mi (betik var mı)? */
  canRun: boolean;
  dir: string;
};

export async function backupSummary(): Promise<BackupSummary> {
  const [files, status, canRun] = await Promise.all([
    listBackups(),
    readBackupStatus(),
    isBackupScriptAvailable(),
  ]);
  return {
    files,
    status,
    report: backupHealth(status, files, Date.now()),
    canRun,
    dir: backupDir(),
  };
}

let running = false;

export type RunResult = { ok: true } | { ok: false; message: string };

/**
 * Yedekleme betiğini çalıştırır. Betik yolu ve ortamı sabit; kullanıcıdan hiçbir
 * değer komuta girmiyor. Aynı anda iki yedek birbirinin dosyasını bozmasın diye
 * tek seferde bir tane.
 */
export async function runBackup(): Promise<RunResult> {
  if (running) return { ok: false, message: "Yedekleme zaten sürüyor." };
  if (!(await isBackupScriptAvailable())) {
    return {
      ok: false,
      message: "Yedekleme betiği bu makinede yok (yalnızca Raspberry Pi kurulumunda).",
    };
  }

  running = true;
  try {
    await run("bash", [scriptPath()], {
      env: {
        ...process.env,
        APP_DIR: process.cwd(),
        OUT_DIR: backupDir(),
      },
      timeout: 5 * 60_000,
    });
    return { ok: true };
  } catch {
    // Ayrıntı betiğin yazdığı durum dosyasında; ekran onu gösteriyor.
    const status = await readBackupStatus();
    return {
      ok: false,
      message: status?.message ?? "Yedek alınamadı. Sunucu günlüğüne bakın.",
    };
  } finally {
    running = false;
  }
}

/** İndirme için dosyayı açar; adı desene uymayan dosyaya hiç dokunmaz. */
export async function openBackup(name: string) {
  if (!isBackupName(name)) return null;

  const file = path.join(backupDir(), name);
  try {
    const info = await stat(file);
    return { size: info.size, stream: createReadStream(file) };
  } catch {
    return null;
  }
}
