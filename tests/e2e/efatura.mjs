import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/efatura"; fs.mkdirSync(out, { recursive: true });
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
  await page.locator('a[href^="/lokasyonlar/"]').first().click();
  await page.waitForURL(/\/lokasyonlar\/[^/]+$/);
  const locationId = page.url().split("/").pop();

  await page.tap('a:has-text("e-Fatura")');
  await page.waitForSelector('h1:has-text("e-Fatura")');
  await page.setInputFiles('input[type="file"]', "/tmp/testfiles/efatura.xml");
  await page.waitForSelector("text=Vatan Bilgisayar", { timeout: 20000 });
  log("XML okundu, satıcı ve kalemler geldi");

  const govde = await page.locator("section").last().innerHTML();
  for (const beklenen of ["Dizüstü Bilgisayar 16GB", "Lenovo 82XQ00E9TX", "Monitör 24 inç", "Kargo Bedeli", "VTN2026000000777"]) {
    if (!govde.includes(beklenen)) throw new Error(`önizlemede eksik: ${beklenen}`);
  }
  // KDV dahil birim fiyatlar: 50.000,00 ve 2.500,00
  if (!govde.includes("50.000,00")) throw new Error("KDV dahil birim fiyat yanlış (dizüstü)");
  if (!govde.includes("2.500,00")) throw new Error("KDV dahil birim fiyat yanlış (monitör)");
  log("KDV dahil birim fiyatlar doğru hesaplandı");
  await page.screenshot({ path: `${out}/1-onizleme.png` });

  // Kargo satırını kullanıcı seçimden çıkarır
  await page.locator('label:has-text("Kargo Bedeli") input[type="checkbox"]').uncheck();
  const dugme = await page.locator('button:has-text("ekipman oluştur")').innerText();
  if (!dugme.startsWith("3 ekipman")) throw new Error(`adet yanlış: ${dugme}`);
  log("kargo çıkarıldı, 1 dizüstü + 2 monitör = 3 ekipman");

  // Onay öncesi kayıt olmamalı
  const oncekiSayi = await page.evaluate(async (id) => {
    const csv = await (await fetch(`/api/lokasyonlar/${id}/csv`)).text();
    return csv.trim().split("\r\n").length;
  }, locationId);

  await page.tap('button:has-text("ekipman oluştur")');
  await page.waitForSelector("text=ekipman eklendi", { timeout: 20000 });
  log("onaydan sonra oluşturuldu");

  const sonrakiSayi = await page.evaluate(async (id) => {
    const csv = await (await fetch(`/api/lokasyonlar/${id}/csv`)).text();
    return csv.trim().split("\r\n").length;
  }, locationId);
  if (sonrakiSayi !== oncekiSayi + 3) {
    throw new Error(`beklenen 3 yeni satır, gelen ${sonrakiSayi - oncekiSayi}`);
  }
  log("tam 3 ekipman eklendi (miktar 2 olan kalem iki kayıt açtı)");

  // Alanlar doğru mu
  await page.goto(`${BASE}/envanter?q=Dizüstü`);
  await page.waitForSelector("text=Dizüstü Bilgisayar 16GB");
  await page.locator('a:has-text("Dizüstü Bilgisayar 16GB")').first().click();
  await page.waitForSelector('h1:has-text("Dizüstü")');
  const detay = await page.locator("body").innerHTML();
  for (const beklenen of ["Lenovo", "82XQ00E9TX", "50.000,00 ₺", "Vatan Bilgisayar", "9 Şubat 2026"]) {
    if (!detay.includes(beklenen)) throw new Error(`detayda eksik: ${beklenen}`);
  }
  log("oluşturulan ekipmanın alanları doğru");
  await page.screenshot({ path: `${out}/2-detay.png` });

  // Fatura olmayan XML reddedilir
  fs.writeFileSync("/tmp/testfiles/bozuk.xml", "<Rapor><Satir>1</Satir></Rapor>");
  await page.goto(`${BASE}/lokasyonlar/${locationId}/e-fatura`);
  await page.setInputFiles('input[type="file"]', "/tmp/testfiles/bozuk.xml");
  await page.waitForSelector("text=e-Fatura/e-Arşiv faturası değil", { timeout: 15000 });
  log("fatura olmayan XML reddedildi");

  // Görüntüleyen bu sayfayı açamaz
  const viewer = await browser.newContext(iphone);
  const vPage = await viewer.newPage();
  await vPage.goto(`${BASE}/giris`);
  await vPage.fill('input[name="username"]', "aysek");
  await vPage.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await vPage.tap('button[type="submit"]');
  await vPage.waitForURL("**/lokasyonlar");
  const res = await vPage.goto(`${BASE}/lokasyonlar/${locationId}/e-fatura`);
  if (res.status() !== 404) throw new Error(`yabancıya ${res.status()} döndü`);
  log("üye olmayan sayfaya erişemiyor");

  console.log("\nE-FATURA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
