import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const KAMERA = process.argv[2];
const ITEM = process.argv[3];

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

  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // Cihazın üstündeki EAN-13 barkodu: seri numarasıyla eşleşen ürün açılmalı.
  await page.goto(`${BASE}/tara`);
  await page.waitForSelector('video[aria-label="Kamera görüntüsü"]');
  await page.waitForURL(`**/envanter/${ITEM}`, { timeout: 30_000 });
  log("EAN-13 okundu → seri numarasından ürün açıldı");
  await page.screenshot({ path: "/tmp/shots-tara/4-barkod.png" });

  console.log("\nBARKOD TESTİ GEÇTİ");
} finally {
  await browser.close();
}
