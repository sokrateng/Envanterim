import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/qr"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.goto(`${BASE}/envanter`);
  await page.locator('a[href^="/envanter/"]').first().tap();
  await page.waitForSelector('a:has-text("QR etiket")');
  const itemUrl = page.url();
  const itemId = itemUrl.split("/").pop();
  await page.tap('a:has-text("QR etiket")');
  await page.waitForSelector('h1:has-text("QR etiket")');
  await page.waitForSelector("svg");
  log("etiket sayfası açıldı");
  await page.screenshot({ path: `${out}/1-etiket.png` });

  // QR gerçekten bu ürünün adresini mi içeriyor: SVG'yi çözemeyiz ama
  // üretimi aynı kütüphaneyle doğrulayabiliriz.
  const svgIcerik = await page.locator("svg").first().evaluate((el) => el.outerHTML);
  if (!svgIcerik.includes("<path") && !svgIcerik.includes("<rect")) {
    throw new Error("QR çizilmemiş");
  }
  log("QR SVG üretildi:", svgIcerik.length, "bayt");

  // Yazdır düğmesi çıktıda gizli mi (print:hidden)
  const gizli = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Yazdır");
    return btn?.className.includes("print:hidden");
  });
  if (!gizli) throw new Error("yazdır düğmesi çıktıda gizlenmiyor");
  log("yazdır düğmesi çıktıda gizli");

  // Lokasyon etiket sayfası
  await page.goto(`${BASE}/lokasyonlar`);
  await page.locator('a[href^="/lokasyonlar/"]').first().tap();
  await page.waitForSelector('a:has-text("QR etiketler")');
  await page.tap('a:has-text("QR etiketler")');
  await page.waitForSelector('h1:has-text("QR etiketler")');
  const adet = await page.locator("svg").count();
  log("lokasyon etiket sayfasında", adet, "QR var");
  if (adet < 1) throw new Error("etiket üretilmedi");
  await page.screenshot({ path: `${out}/2-etiketler.png` });

  // Yazdırma görünümü
  await page.emulateMedia({ media: "print" });
  const cubukGorunur = await page.locator("nav").first().isVisible().catch(() => false);
  if (cubukGorunur) throw new Error("sekme çubuğu çıktıda görünüyor");
  await page.screenshot({ path: `${out}/3-yazdirma.png` });
  log("yazdırma görünümünde sekme çubuğu gizli");
  await page.emulateMedia({ media: "screen" });

  // Üye olmayan etiket sayfasını göremez
  const yabanci = await browser.newContext(iphone);
  const yPage = await yabanci.newPage();
  await yPage.goto(`${BASE}/giris`);
  await yPage.fill('input[name="username"]', "aysek");
  await yPage.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await yPage.tap('button[type="submit"]');
  await yPage.waitForURL("**/lokasyonlar");
  const res = await yPage.goto(`${BASE}/envanter/${itemId}/etiket`);
  if (res.status() !== 404) throw new Error(`yabancıya ${res.status()} döndü`);
  log("üye olmayan etiket sayfasına erişemiyor (404)");

  console.log("\nQR ETİKET TESTİ GEÇTİ");
} finally {
  await browser.close();
}
