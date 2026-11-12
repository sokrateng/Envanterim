-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "inviteCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "emailVerifiedAt" DATETIME,
    "emailReminders" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewItem" BOOLEAN NOT NULL DEFAULT true,
    "notifyItemChange" BOOLEAN NOT NULL DEFAULT false,
    "emailCodeHash" TEXT,
    "emailCodeExpiresAt" DATETIME,
    "emailCodeTries" INTEGER NOT NULL DEFAULT 0,
    "resetCodeHash" TEXT,
    "resetCodeExpiresAt" DATETIME,
    "resetCodeTries" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LocationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationMember_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedById" TEXT,
    CONSTRAINT "LocationInvite_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CategoryField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "note" TEXT,
    "isSeller" BOOLEAN NOT NULL DEFAULT true,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Vendor_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "place" TEXT,
    "sellerId" TEXT,
    "purchaseDate" DATETIME,
    "purchasePriceMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "warrantyEndDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_USE',
    "customFields" JSONB NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "holderUserId" TEXT,
    "holderName" TEXT,
    "assignedById" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "acceptedAt" DATETIME,
    "acceptedById" TEXT,
    "closedAt" DATETIME,
    "closedReason" TEXT,
    "closedById" TEXT,
    CONSTRAINT "ItemAssignment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemAssignment_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemAssignment_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "everyMonths" INTEGER,
    "everyReading" REAL,
    "readingUnit" TEXT,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "lastNotifiedCycle" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    CONSTRAINT "ShareLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noteId" TEXT,
    CONSTRAINT "Attachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ItemNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "vendorId" TEXT,
    "complaint" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL,
    "trackingNo" TEXT,
    "trackingUrl" TEXT,
    "returnedAt" DATETIME,
    "work" TEXT,
    "costMinor" INTEGER,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "underWarranty" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceJob_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItemNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemFavorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItemRating_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "readingValue" REAL,
    "readingUnit" TEXT,
    "costMinor" INTEGER,
    "vendorId" TEXT,
    "assignedToUserId" TEXT,
    "assignedPlace" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemEvent_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNo" TEXT,
    "priceMinor" INTEGER,
    "vendorId" TEXT,
    "stock" INTEGER,
    CONSTRAINT "Part_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Part_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "leadDays" INTEGER NOT NULL DEFAULT 30,
    "sentAt" DATETIME,
    CONSTRAINT "ItemReminder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "attachmentId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LocationMember_userId_idx" ON "LocationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationMember_locationId_userId_key" ON "LocationMember"("locationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationInvite_code_key" ON "LocationInvite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LocationInvite_usedById_key" ON "LocationInvite"("usedById");

-- CreateIndex
CREATE INDEX "LocationInvite_locationId_idx" ON "LocationInvite"("locationId");

-- CreateIndex
CREATE INDEX "Category_locationId_idx" ON "Category"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryField_categoryId_key_key" ON "CategoryField"("categoryId", "key");

-- CreateIndex
CREATE INDEX "Vendor_locationId_idx" ON "Vendor"("locationId");

-- CreateIndex
CREATE INDEX "Item_locationId_status_idx" ON "Item"("locationId", "status");

-- CreateIndex
CREATE INDEX "Item_locationId_categoryId_idx" ON "Item"("locationId", "categoryId");

-- CreateIndex
CREATE INDEX "Item_serialNo_idx" ON "Item"("serialNo");

-- CreateIndex
CREATE INDEX "Item_parentId_idx" ON "Item"("parentId");

-- CreateIndex
CREATE INDEX "ItemAssignment_itemId_assignedAt_idx" ON "ItemAssignment"("itemId", "assignedAt");

-- CreateIndex
CREATE INDEX "ItemAssignment_holderUserId_closedAt_idx" ON "ItemAssignment"("holderUserId", "closedAt");

-- CreateIndex
CREATE INDEX "MaintenanceRule_itemId_idx" ON "MaintenanceRule"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_itemId_idx" ON "ShareLink"("itemId");

-- CreateIndex
CREATE INDEX "Attachment_itemId_idx" ON "Attachment"("itemId");

-- CreateIndex
CREATE INDEX "Attachment_noteId_idx" ON "Attachment"("noteId");

-- CreateIndex
CREATE INDEX "ServiceJob_itemId_sentAt_idx" ON "ServiceJob"("itemId", "sentAt");

-- CreateIndex
CREATE INDEX "ItemNote_itemId_createdAt_idx" ON "ItemNote"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "ItemFavorite_userId_idx" ON "ItemFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFavorite_itemId_userId_key" ON "ItemFavorite"("itemId", "userId");

-- CreateIndex
CREATE INDEX "ItemRating_itemId_idx" ON "ItemRating"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemRating_itemId_userId_key" ON "ItemRating"("itemId", "userId");

-- CreateIndex
CREATE INDEX "ItemEvent_itemId_date_idx" ON "ItemEvent"("itemId", "date");

-- CreateIndex
CREATE INDEX "Part_itemId_idx" ON "Part"("itemId");

-- CreateIndex
CREATE INDEX "ItemReminder_dueDate_idx" ON "ItemReminder"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ItemReminder_itemId_kind_dueDate_leadDays_key" ON "ItemReminder"("itemId", "kind", "dueDate", "leadDays");

-- CreateIndex
CREATE INDEX "InvoiceRead_userId_createdAt_idx" ON "InvoiceRead"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_locationId_createdAt_idx" ON "AuditLog"("locationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
