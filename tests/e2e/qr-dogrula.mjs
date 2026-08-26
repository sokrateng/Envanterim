import { chromium, devices } from "playwright";
import QRCode from "/home/user/Envanterim/node_modules/qrcode/lib/index.js";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");
  await page.goto(`${BASE}/envanter`);
  const href = await page.locator('a[href^="/envanter/"]').first().getAttribute("href");
  const itemId = href.split("/").pop();
  await page.goto(`${BASE}/envanter/${itemId}/etiket`);
  await page.waitForSelector("svg");
  const sayfaSvg = await page.locator("svg").first().evaluate((el) => el.outerHTML);

  const beklenenUrl = `http://localhost:3000/envanter/${itemId}`;
  const beklenenSvg = await QRCode.toString(beklenenUrl, { type: "svg", margin: 0, width: 140, errorCorrectionLevel: "M" });

  // İlk yol arka plan dikdörtgeni; modüller en uzun yolda.
  const yol = (svg) =>
    [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0] ?? "";
  if (!yol(sayfaSvg)) throw new Error("sayfadaki QR'da yol yok");
  if (yol(sayfaSvg) !== yol(beklenenSvg)) throw new Error("QR beklenen adresi taşımıyor");
  console.log("· QR içeriği doğrulandı:", beklenenUrl);

  const yanlisSvg = await QRCode.toString(`${beklenenUrl}x`, { type: "svg", margin: 0, width: 140 });
  if (yol(sayfaSvg) === yol(yanlisSvg)) throw new Error("karşılaştırma anlamsız — her QR aynı çıkıyor");
  console.log("· karşılaştırma ayırt edici (farklı adres farklı QR)");
} finally {
  await browser.close();
}
