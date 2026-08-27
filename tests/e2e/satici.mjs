import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/satici"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
/**
 * Satıcı tek alan gibi davranıyor: lokasyonun satıcısı varsa açılır liste,
 * "+ Yeni satıcı…" seçilince ad kutusu. Hiç satıcı yoksa doğrudan ad kutusu.
 */
async function yeniSatici(page, ad) {
  const liste = page.locator('select[name="sellerId"]');
  if (await liste.count()) await liste.selectOption("__yeni__");
  await page.fill('input[name="sellerName"]', ad);
}

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // Yeni ekipman: satıcı adı yazılarak açılır
  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.fill('input[name="name"]', "Klima");
  await yeniSatici(page, "Teknosa");
  await page.fill('input[name="purchasePrice"]', "31.250");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Klima");
  log("satıcı adı yazılarak ekipman eklendi");

  await page.locator("a:has-text('Klima')").first().tap();
  await page.waitForSelector('h1:has-text("Klima")');
  const body = await page.locator("body").innerText();
  if (!body.includes("Teknosa")) throw new Error("satıcı detayda görünmüyor");
  if (!body.includes("31.250,00 ₺")) throw new Error("tutar yanlış: " + body.match(/[\d.,]+ ₺/));
  log("satıcı ve tutar detayda doğru");
  await page.screenshot({ path: `${out}/1-detay.png` });

  // İkinci ekipman: aynı satıcı listeden seçilebilmeli (tekrar açılmamalı)
  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.waitForSelector('div[role="dialog"] select[name="sellerId"]');
  const options = await page.locator('select[name="sellerId"] option').allInnerTexts();
  if (!options.includes("Teknosa")) throw new Error("satıcı listede yok: " + options.join(","));
  await page.fill('input[name="name"]', "Televizyon");
  await page.selectOption('select[name="sellerId"]', { label: "Teknosa" });
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Televizyon");
  log("var olan satıcı listeden seçildi");

  // Aynı adı tekrar yazmak yeni satıcı açmamalı
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.fill('input[name="name"]', "Fırın");
  await yeniSatici(page, "teknosa");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Fırın");
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.waitForSelector('div[role="dialog"] select[name="sellerId"]');
  const options2 = await page.locator('select[name="sellerId"] option').allInnerTexts();
  const count = options2.filter((o) => o.toLowerCase() === "teknosa").length;
  if (count !== 1) throw new Error(`satıcı ${count} kez var, tekilleşmedi`);
  log("aynı ad büyük/küçük harf farkıyla da tekilleşiyor");

  // Para birimi: varsayılan TRY, seçilince o birimde görünüyor
  await page.fill('input[name="name"]', "Kulaklık");
  await page.fill('input[name="purchasePrice"]', "249,90");
  await page.selectOption('select[name="currency"]', "USD");
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector("text=Kulaklık");
  await page.locator("a:has-text('Kulaklık')").first().tap();
  await page.waitForSelector('h1:has-text("Kulaklık")');
  const dolar = await page.locator("body").innerText();
  if (!dolar.includes("249,90 $")) {
    throw new Error("dolar tutarı yanlış: " + (dolar.match(/[\d.,]+ [^\s]/) ?? []));
  }
  log("USD seçilen ekipman kendi biriminde görünüyor");
  await page.screenshot({ path: `${out}/2-usd.png` });

  console.log("\nSATICI TESTİ GEÇTİ");
} finally {
  await browser.close();
}
