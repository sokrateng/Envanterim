-- Envanter olayları için kişisel bildirim tercihleri.
-- Yeni ekipman varsayılan açık; değişiklik haberi kapalı (düzenleme sık).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifyNewItem" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN "notifyItemChange" BOOLEAN NOT NULL DEFAULT false;
