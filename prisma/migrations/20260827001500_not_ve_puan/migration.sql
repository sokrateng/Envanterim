-- Kullanıcı notları (fotoğraflı) ve beğeni yıldızı.

-- CreateTable
CREATE TABLE "ItemNote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRating" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemRating_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "noteId" TEXT;

-- CreateIndex
CREATE INDEX "ItemNote_itemId_createdAt_idx" ON "ItemNote"("itemId", "createdAt");
CREATE INDEX "ItemRating_itemId_idx" ON "ItemRating"("itemId");
CREATE UNIQUE INDEX "ItemRating_itemId_userId_key" ON "ItemRating"("itemId", "userId");
CREATE INDEX "Attachment_noteId_idx" ON "Attachment"("noteId");

-- AddForeignKey
ALTER TABLE "ItemNote" ADD CONSTRAINT "ItemNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemNote" ADD CONSTRAINT "ItemNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemRating" ADD CONSTRAINT "ItemRating_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemRating" ADD CONSTRAINT "ItemRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ItemNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
