/**
 * zxing-wasm'ın .wasm dosyasını public/ altına kopyalar.
 *
 * Kütüphane varsayılan olarak dosyayı jsDelivr'dan çekiyor; uygulama kendi
 * sunduğu dosyayı kullanmalı: dış CDN'e bağımlı bir tarayıcı ekranı ne
 * çevrimdışı çalışır ne de sıkı bir CSP'den geçer.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hedefDizin = join(root, "public", "zxing");

try {
  const kaynak = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
  mkdirSync(hedefDizin, { recursive: true });
  copyFileSync(kaynak, join(hedefDizin, "zxing_reader.wasm"));
  console.log("zxing_reader.wasm → public/zxing/");
} catch (error) {
  // Kurulum kırılmasın: tarayıcı ekranı yoksa da uygulamanın kalanı çalışır.
  console.warn("zxing_reader.wasm kopyalanamadı:", error.message);
}
