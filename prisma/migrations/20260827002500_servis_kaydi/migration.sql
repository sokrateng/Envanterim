-- Yetkili servise gönderim: arızadan sonuca kadar tek kayıt.

-- CreateTable
CREATE TABLE "ServiceJob" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vendorId" TEXT,
    "complaint" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "trackingNo" TEXT,
    "returnedAt" TIMESTAMP(3),
    "work" TEXT,
    "costMinor" INTEGER,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "underWarranty" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceJob_itemId_sentAt_idx" ON "ServiceJob"("itemId", "sentAt");

-- AddForeignKey
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
