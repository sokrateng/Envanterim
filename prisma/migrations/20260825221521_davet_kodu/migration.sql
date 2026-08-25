-- CreateTable
CREATE TABLE "LocationInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,

    CONSTRAINT "LocationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationInvite_code_key" ON "LocationInvite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LocationInvite_usedById_key" ON "LocationInvite"("usedById");

-- CreateIndex
CREATE INDEX "LocationInvite_locationId_idx" ON "LocationInvite"("locationId");

-- AddForeignKey
ALTER TABLE "LocationInvite" ADD CONSTRAINT "LocationInvite_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationInvite" ADD CONSTRAINT "LocationInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationInvite" ADD CONSTRAINT "LocationInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
