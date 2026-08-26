import { chromium, devices } from "playwright";
import fs from "node:fs";

const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/tara";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const KAMERA = process.argv[2];
const ITEM = process.argv[3];
const SERI = process.argv[4] ?? "SN-4471-A";

const iphone = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};
const log = (...a) => console.log("·", ...a);

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${KAMERA}`,
  ],
});

try {
  const context = await browser.newContext({ ...iphone, permissions: ["camera"] });
  const page = await context.newPage();

  const istekler = [];
  page.on("request", (r) => istekler.push(r.url()));

  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // 1) Envanter ekranından tarayıcıya giriş
  await page.goto(`${BASE}/envanter`);
  await page.waitForSelector('a[aria-label="Kod tara"]');
  await page.tap('a[aria-label="Kod tara"]');
  await page.waitForURL("**/tara");
  await page.waitForSelector('video[aria-label="Kamera görüntüsü"]');
  log("tara ekranı açıldı");

  // 2) Sahte kameradaki QR okunmalı ve ürün sayfasına gitmeli
  await page.waitForURL(`**/envanter/${ITEM}`, { timeout: 30_000 });
  log("QR okundu → ürün açıldı:", page.url().split("/").pop());
  await page.screenshot({ path: `${out}/1-urun.png` });

  const wasm = istekler.filter((u) => u.endsWith(".wasm"));
  if (!wasm.some((u) => u.startsWith(`${BASE}/zxing/`))) {
    throw new Error(`wasm kendi sunucumuzdan gelmedi: ${wasm.join(", ")}`);
  }
  if (istekler.some((u) => u.includes("jsdelivr") || u.includes("unpkg"))) {
    throw new Error("dış CDN'e istek gitti");
  }
  log("wasm kendi sunucumuzdan indi, dış CDN yok");

  // Kamera kapandı mı: sayfadan çıkınca izleyici durmalı
  const acikKamera = await page.evaluate(() => document.querySelectorAll("video").length);
  if (acikKamera !== 0) throw new Error("ürün sayfasında video kaldı");
  log("ürün sayfasında kamera kapalı");

  // 3) Elle kod: seri numarası tek ürüne denk geliyorsa doğrudan açılmalı
  await page.goto(`${BASE}/tara`);
  await page.waitForSelector('input[aria-label="Kodu elle yaz"]');
  await page.fill('input[aria-label="Kodu elle yaz"]', SERI);
  await page.screenshot({ path: `${out}/2-elle.png` });
  await page.tap('button:has-text("Ara")');
  await page.waitForURL(`**/envanter/${ITEM}`, { timeout: 20_000 });
  log("seri no ile ürün açıldı");

  // 4) Eşleşmeyen kod aramaya düşmeli
  await page.goto(`${BASE}/tara`);
  await page.fill('input[aria-label="Kodu elle yaz"]', "YOKBOYLE123");
  await page.tap('button:has-text("Ara")');
  await page.waitForURL("**/envanter?q=YOKBOYLE123", { timeout: 20_000 });
  const bos = await page.locator("text=Sonuç yok").count();
  log("eşleşmeyen kod aramaya düştü", bos ? "(liste boş)" : "");

  // 5) Yabancı QR açılmamalı
  await page.goto(`${BASE}/tara`);
  await page.fill('input[aria-label="Kodu elle yaz"]', "https://baska.site/envanterim");
  await page.tap('button:has-text("Ara")');
  await page.waitForSelector(String.raw`p[role="alert"]`);
  const uyari = await page.locator(String.raw`p[role="alert"]`).innerText();
  if (!uyari.includes("etiketi değil")) throw new Error(`beklenmeyen uyarı: ${uyari}`);
  if (page.url().includes("baska.site")) throw new Error("yabancı adrese gidildi");
  log("yabancı QR açılmadı:", uyari);
  await page.screenshot({ path: `${out}/3-yabanci.png` });

  // 6) Başkasının etiketi: olmayan kimlik sızdırmadan "bulunamadı"
  const yanit = await page.evaluate(async () => {
    const r = await fetch("/api/tara", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kod: "http://localhost:3000/envanter/cxxxxxxxxxxxxxxxxxxxxxxxx" }),
    });
    return { durum: r.status, govde: await r.json() };
  });
  if (yanit.govde.tur !== "bulunamadi") throw new Error(JSON.stringify(yanit));
  log("tanınmayan kimlik → bulunamadı");

  // 7) Giriş yapmamış kullanıcı okutamaz
  const anonim = await browser.newContext(iphone);
  const anonimYanit = await (await anonim.newPage()).request.post(`${BASE}/api/tara`, {
    data: { kod: `${BASE}/envanter/${ITEM}` },
  });
  if (anonimYanit.status() !== 401) {
    throw new Error(`girişsiz istek ${anonimYanit.status()} döndü`);
  }
  log("girişsiz istek 401");

  console.log("\nTARAMA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
