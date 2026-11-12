import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_HOURS,
  backupHealth,
  backupKind,
  formatBytes,
  isBackupName,
  parseBackupStatus,
  toBackupFiles,
} from "./backup";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);

describe("backupKind", () => {
  it("backup.sh'in adlarını tanır", () => {
    expect(backupKind("envanterim-20261112-083418.db")).toBe("db");
    expect(backupKind("dosyalar-20261112-083418.tar.gz")).toBe("files");
  });

  it("yedek olmayanı ve yol gezintisini reddeder", () => {
    expect(isBackupName("yedek.log")).toBe(false);
    expect(isBackupName("durum.json")).toBe(false);
    expect(isBackupName("../.env")).toBe(false);
    expect(isBackupName("envanterim-20261112-083418.db/../x")).toBe(false);
    expect(isBackupName("envanterim-1.db")).toBe(false);
  });
});

describe("toBackupFiles", () => {
  it("yedek olmayanları eler, yeniden eskiye sıralar", () => {
    const files = toBackupFiles([
      { name: "envanterim-20261111-030000.db", size: 1, modifiedAt: 1 },
      { name: "yedek.log", size: 1, modifiedAt: 99 },
      { name: "envanterim-20261112-030000.db", size: 1, modifiedAt: 2 },
    ]);
    expect(files.map((f) => f.name)).toEqual([
      "envanterim-20261112-030000.db",
      "envanterim-20261111-030000.db",
    ]);
  });
});

describe("parseBackupStatus", () => {
  it("geçerli durumu okur", () => {
    const status = parseBackupStatus(
      JSON.stringify({ state: "ok", finishedAt: "2026-11-12T08:34:18+03:00", db: null }),
    );
    expect(status?.state).toBe("ok");
  });

  it("bozuk ya da şemaya uymayan içerikte null döner", () => {
    expect(parseBackupStatus("{bozuk")).toBeNull();
    expect(parseBackupStatus(JSON.stringify({ state: "belki" }))).toBeNull();
  });
});

describe("backupHealth", () => {
  const fresh = toBackupFiles([
    { name: "envanterim-20261112-030000.db", size: 10, modifiedAt: NOW - 2 * HOUR },
  ]);

  it("taze yedek varsa ok", () => {
    expect(backupHealth(null, fresh, NOW).health).toBe("ok");
  });

  it("hiç yedek yoksa none", () => {
    expect(backupHealth(null, [], NOW).health).toBe("none");
  });

  it("son yedek eşikten eskiyse stale", () => {
    const old = toBackupFiles([
      {
        name: "envanterim-20261101-030000.db",
        size: 10,
        modifiedAt: NOW - (STALE_AFTER_HOURS + 1) * HOUR,
      },
    ]);
    expect(backupHealth(null, old, NOW).health).toBe("stale");
  });

  it("son çalışma hataysa taze dosya olsa da error", () => {
    const status = { state: "error" as const, finishedAt: "x", message: "disk dolu" };
    const report = backupHealth(status, fresh, NOW);
    expect(report.health).toBe("error");
    expect(report.message).toBe("disk dolu");
  });
});

describe("formatBytes", () => {
  it("okunur biçimde yazar", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(360448)).toBe("352 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
  });
});
