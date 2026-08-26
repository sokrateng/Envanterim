-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetCodeHash" TEXT,
ADD COLUMN     "resetCodeTries" INTEGER NOT NULL DEFAULT 0;

