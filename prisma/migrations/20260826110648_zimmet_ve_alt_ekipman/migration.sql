-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "ItemAssignment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "holderUserId" TEXT,
    "holderName" TEXT,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "closedById" TEXT,

    CONSTRAINT "ItemAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemAssignment_itemId_assignedAt_idx" ON "ItemAssignment"("itemId", "assignedAt");

-- CreateIndex
CREATE INDEX "ItemAssignment_holderUserId_closedAt_idx" ON "ItemAssignment"("holderUserId", "closedAt");

-- CreateIndex
CREATE INDEX "Item_parentId_idx" ON "Item"("parentId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

