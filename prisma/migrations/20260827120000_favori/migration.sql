-- Kişisel favori işareti: kullanıcı başına ekipman.

-- CreateTable
CREATE TABLE "ItemFavorite" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemFavorite_itemId_userId_key" ON "ItemFavorite"("itemId", "userId");

-- CreateIndex
CREATE INDEX "ItemFavorite_userId_idx" ON "ItemFavorite"("userId");

-- AddForeignKey
ALTER TABLE "ItemFavorite" ADD CONSTRAINT "ItemFavorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFavorite" ADD CONSTRAINT "ItemFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
