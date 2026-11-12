import { PrismaClient } from "@prisma/client";

// Geliştirmede hot reload her seferinde yeni istemci açmasın; Postgres
// bağlantı havuzu birkaç dakikada tükenir.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite'ta yazan okuyanı beklemesin: WAL modu dosyada kalıcı, bir kez açmak
// yeter. Derleme sırasında veritabanına dokunulmuyor.
if (
  process.env.DATABASE_URL?.startsWith("file:") &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL").catch(() => {
    // WAL açılamazsa varsayılan günlük modu çalışmaya devam eder.
  });
}
