import { chromium, devices } from "playwright";
import { bolumAc } from "./ortak.mjs";
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
  // Kendi ekipmanını açıyor: hazır fotoğrafı olan bir kaydın üstüne yüklemek,
  // ölçümü eski fotoğraftan yapma riski taşıyor.
  const AD = "Küçültme " + Date.now().toString().slice(-6);
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', AD);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${AD}`, { timeout: 15000 });
  await page.locator(`a:has-text("${AD}")`).first().tap();
  await bolumAc(page, "Fotoğraf ve belgeler");
  await page.selectOption('select[aria-label="Belge türü"]', "PHOTO");
  await page.setInputFiles('details:has(summary:has-text("Fotoğraf ve belgeler")) input[type="file"]', "/tmp/testfiles/buyuk.png");
  await page.waitForSelector("figure img", { timeout: 30000 });
  const src = await page.locator("figure img").first().getAttribute("src");
  const info = await page.evaluate(async (u) => {
    const r = await fetch(u);
    const buf = await r.arrayBuffer();
    const bitmap = await createImageBitmap(await (await fetch(u)).blob());
    return { tur: r.headers.get("content-type"), bayt: buf.byteLength, en: bitmap.width, boy: bitmap.height };
  }, src);
  console.log("· yüklenen:", JSON.stringify(info));
  if (info.en > 2000 || info.boy > 2000) throw new Error("küçültme çalışmadı");
  if (info.tur !== "image/jpeg") throw new Error("JPEG'e çevrilmedi: " + info.tur);
  console.log("\nKÜÇÜLTME ÇALIŞIYOR");
} finally {
  await browser.close();
}
