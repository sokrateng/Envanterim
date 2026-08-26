-- Fatura okuma artık ekipman açılmadan da yapılabiliyor (yeni ekipman
-- formunda faturayı taratıp alanları doldurmak): bağlanacak kayıt henüz yok.
-- AlterTable
ALTER TABLE "InvoiceRead" ALTER COLUMN "itemId" DROP NOT NULL,
                          ALTER COLUMN "attachmentId" DROP NOT NULL;
