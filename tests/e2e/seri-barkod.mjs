/**
 * Seri no alanındaki barkod okuyucu.
 *
 * Cihazın üstündeki barkod alana yazılıyor; kendi QR etiketimiz yazılmıyor —
 * alanın sessizce ürün adresiyle dolması, boş kalmasından kötü.
 *
 * Sahte kamera gerekir:
 *   node tests/e2e/sahte/y4m.mjs ean13 8690637123467 /tmp/seri.y4m
 *   node tests/e2e/seri-barkod.mjs /tmp/seri.y4m 8690637123467
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";

const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/seri-barkod";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const KAMERA = process.argv[2];
// tara-barkod testindeki barkoddan farklı: bu test kalıcı bir ekipman açıyor,
// aynı seri no iki kayda düşerse o test "tek eşleşme" bulamıyor.
const BEKLENEN = process.argv[3] ?? "8690637123467";
/** İkinci sahte kamera: kendi QR etiketimiz. Verilmezse o adım atlanıyor. */
const ETIKET_KAMERA = process.argv[4];

const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
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

  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.waitForSelector('input[name="serialNo"]');

  await page.tap('button[aria-label="Seri numarasını barkoddan oku"]');
  await page.waitForSelector('video[aria-label="Kamera görüntüsü"]');
  log("kamera paneli açıldı");
  await page.screenshot({ path: `${out}/1-kamera.png` });

  await page.waitForFunction(
    (beklenen) =>
      document.querySelector('input[name="serialNo"]')?.value === beklenen,
    BEKLENEN,
    { timeout: 30_000 },
  );
  log("barkod okundu, seri no alanına yazıldı:", BEKLENEN);

  // Panel kapanmış olmalı: okuma bitince kamera durur.
  await page.waitForSelector('video[aria-label="Kamera görüntüsü"]', {
    state: "detached",
    timeout: 10_000,
  });
  log("okuma bitince kamera kapandı");
  await page.screenshot({ path: `${out}/2-alan.png` });

  // Kaydedilince seri no gerçekten kayda giriyor.
  const etiket = `Barkodlu ${Date.now()}`;
  await page.fill('input[name="name"]', etiket);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${etiket}`, { timeout: 20_000 });
  await page.locator(`a:has-text("${etiket}")`).first().tap();
  await page.waitForSelector(`text=${BEKLENEN}`, { timeout: 15_000 });
  log("seri no kaydedildi");

  console.log("\nSERİ NO BARKOD TESTİ GEÇTİ");
} finally {
  await browser.close();
}

// Kendi QR etiketimiz seri no değil: alan boş kalmalı ve sebebi yazılmalı.
if (ETIKET_KAMERA) {
  const ikinci = await chromium.launch({
    ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${ETIKET_KAMERA}`,
    ],
  });

  try {
    const context = await ikinci.newContext({ ...iphone, permissions: ["camera"] });
    const page = await context.newPage();

    await page.goto(`${BASE}/giris`);
    await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
    await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
    await page.tap('button[type="submit"]');
    await page.waitForURL("**/lokasyonlar");

    await page.goto(`${BASE}/envanter`);
    await page.tap('button[aria-label="Ekipman ekle"]');
    await page.tap('button[aria-label="Seri numarasını barkoddan oku"]');
    await page.waitForSelector("text=Bu Envanterim etiketi", { timeout: 30_000 });

    const deger = await page.inputValue('input[name="serialNo"]');
    if (deger !== "") throw new Error(`etiket seri no alanına yazıldı: ${deger}`);
    log("kendi etiketimiz seri no sayılmadı, alan boş kaldı");
    await page.screenshot({ path: `${out}/3-etiket-reddedildi.png` });

    console.log("\nETİKET AYIRMA TESTİ GEÇTİ");
  } finally {
    await ikinci.close();
  }
}
