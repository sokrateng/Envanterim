import { chromium, devices } from "playwright";
import { bolumAc } from "./ortak.mjs";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
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
  await page.tap('a[aria-label="Yeni ekipman"]');
  const ad = "Parça testi " + Date.now();
  await page.fill('input[name="name"]', ad);
  await page.fill('input[name="purchasePrice"]', "10.000");
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad}`);
  await page.locator(`a:has-text("${ad}")`).first().click();
  await bolumAc(page, "Yedek parçalar");
  await page.tap('button:has-text("+ Parça")');
  await page.fill('input[name="name"]', "Su filtresi");
  await page.fill('input[name="partNo"]', "00634665");
  await page.fill('input[name="price"]', "450,00");
  await page.fill('input[name="stock"]', "2");
  await page.fill('input[name="vendorName"]', "Yedek Parça A.Ş.");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Su filtresi", { timeout: 15000 });
  log("parça eklendi");

  const govde = await page.locator("body").innerText();
  for (const beklenen of ["No 00634665", "Yedek Parça A.Ş.", "Stok 2", "450,00 ₺"]) {
    if (!govde.includes(beklenen)) throw new Error(`eksik: ${beklenen}`);
  }
  log("parça ayrıntıları görünüyor");

  // Sahip olma maliyeti: 10.000,00 + 450,00
  if (!govde.includes("10.450,00 ₺")) throw new Error("parça maliyete eklenmedi");
  log("parça sahip olma maliyetine eklendi: 10.450,00 ₺");

  // Geçersiz stok reddedilir
  const itemId = page.url().split("/").pop();
  const durum = await page.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/parcalar`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", stock: "1.5" }),
    });
    return { durum: r.status, govde: await r.json() };
  }, itemId);
  if (durum.durum !== 422) throw new Error(`geçersiz stok ${durum.durum} döndü`);
  log("geçersiz stok reddedildi:", durum.govde.hata);

  await page.locator('li:has-text("Su filtresi") button:has-text("Sil")').first().click();
  await page.locator('li:has-text("Su filtresi")').waitFor({ state: "detached", timeout: 15000 });
  log("parça silindi");

  console.log("\nYEDEK PARÇA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
