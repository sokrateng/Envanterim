// scripts/icon.svg'den uygulama ikonlarını üretir: node scripts/make-icons.mjs
// Çıktı public/ altına yazılır; PNG'ler depoda tutulur, bu betik yalnız ikon
// tasarımı değişince çalıştırılır.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = await readFile(new URL("./icon.svg", import.meta.url));
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const targets = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  // iOS ana ekran ikonu; saydamlık olmamalı, SVG zemini zaten tam kare.
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  // Yüksek yoğunlukla çizip küçültmek keskin kenar verir.
  await sharp(svg, { density: (72 * size * 2) / 100 })
    .resize(size, size)
    .png()
    .toFile(publicDir + name);
  console.log(`${name} (${size}×${size})`);
}
