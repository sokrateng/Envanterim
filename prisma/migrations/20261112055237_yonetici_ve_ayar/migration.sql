-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable
-- Prisma bunu "tabloyu yeniden kur" diye üretiyordu; sütun sona ve varsayılanlı
-- eklendiği için düz ADD COLUMN aynı sonucu verir ve kullanıcı satırlarına
-- hiç dokunmaz.
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut kurulumda ilk açılan hesap sistem yöneticisi sayılır: yönetici ekranı
-- boş kalmasın. Sonradan açılan hesaplar yönetici olmaz.
UPDATE "User" SET "isAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
