-- Servis kaydının takip sayfası: numara verilirken adres de veriliyor,
-- kullanıcı durumu oradan izliyor.
ALTER TABLE "ServiceJob" ADD COLUMN "trackingUrl" TEXT;
