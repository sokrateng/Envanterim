/**
 * Uçtan uca testleri sırayla koşturur ve sonunda özet basar.
 *
 *   node tests/e2e/kos.mjs              # dış servis istemeyenler
 *   node tests/e2e/kos.mjs smoke zimmet # seçilenler
 *   node tests/e2e/kos.mjs --hepsi      # sahte servis isteyenler dahil
 *
 * Sunucu ayakta olmalı (`npm run build && npm run start`) ve veritabanında
 * tohum bulunmalı (`npm run seed:e2e`). Sahte servis isteyen testler için
 * tests/e2e/README.md'ye bak.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const buDizin = dirname(fileURLToPath(import.meta.url));

/** Dış servis istemeyenler: sunucu ve veritabanı yeterli. */
const TEMEL = [
  "smoke",
  "invite",
  "kategori",
  "satici",
  "zaman",
  "parca",
  "ekler",
  "kucultme",
  "etiket",
  "qr-dogrula",
  "pwa",
  "csv",
  "rapor",
  "efatura",
  "paylasim",
  "zimmet",
  "kaydirma",
  "hesap",
  "cevrimdisi",
  "not-puan",
  "servis",
];

/** Sahte servis ya da özel sunucu bayrağı isteyenler. */
const DIS_SERVIS = {
  fatura: "sahte Anthropic (ANTHROPIC_BASE_URL)",
  "fatura-yeni": "sahte Anthropic (ANTHROPIC_BASE_URL)",
  "fatura-foto": "sahte Anthropic (ANTHROPIC_BASE_URL)",
  bildirim: "sahte push sunucusu + VAPID",
  eposta: "sahte SMTP (SMTP_URL)",
  bakim: "bildirim kanalı açık sunucu (VAPID ya da SMTP)",
  tara: "sahte kamera (y4m dosyası argümanla)",
  "tara-barkod": "sahte kamera (y4m dosyası argümanla)",
  "seri-barkod": "sahte kamera (y4m dosyası argümanla)",
};

const secilen = process.argv.slice(2);
const hepsi = secilen.includes("--hepsi");
const liste = hepsi
  ? [...TEMEL, ...Object.keys(DIS_SERVIS)]
  : secilen.filter((ad) => !ad.startsWith("--")).length
    ? secilen.filter((ad) => !ad.startsWith("--"))
    : TEMEL;

function kos(ad) {
  return new Promise((resolve) => {
    const cocuk = spawn(process.execPath, [join(buDizin, `${ad}.mjs`)], {
      stdio: "inherit",
    });
    cocuk.on("exit", (kod) => resolve(kod === 0));
  });
}

const basarili = [];
const basarisiz = [];

for (const ad of liste) {
  console.log(`\n──────── ${ad} ────────`);
  if (DIS_SERVIS[ad] && !hepsi && !secilen.includes(ad)) continue;
  const ok = await kos(ad);
  (ok ? basarili : basarisiz).push(ad);
}

console.log("\n════════ ÖZET ════════");
console.log(`geçen: ${basarili.length} — ${basarili.join(", ")}`);
if (basarisiz.length) {
  console.log(`kalan: ${basarisiz.length} — ${basarisiz.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("hepsi geçti");
}

if (!hepsi) {
  const atlanan = Object.entries(DIS_SERVIS).filter(([ad]) => !liste.includes(ad));
  if (atlanan.length) {
    // Sessiz atlama "her şey kapsandı" gibi okunuyor; ne kaldığını yaz.
    console.log("\natlananlar (dış servis ister):");
    for (const [ad, neden] of atlanan) console.log(`  ${ad} — ${neden}`);
  }
}
