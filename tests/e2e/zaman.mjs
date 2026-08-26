import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/zaman"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const gun = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const ad = "Servis testi " + Date.now();
  await page.fill('input[name="name"]', ad);
  await page.fill('input[name="purchasePrice"]', "18.400,50");
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad}`);
  await page.locator(`a:has-text("${ad}")`).first().tap();
  await page.waitForSelector(`h1:has-text("${ad}")`);
  await page.waitForSelector('button:has-text("+ Kayıt")');
  const itemUrl = page.url();
  log("ekipman açıldı, zaman çizelgesi boş");

  const kayit = async (doldur) => {
    await page.tap('button:has-text("+ Kayıt")');
    await doldur();
    await page.tap('button[type="submit"]');
    await page.waitForTimeout(1500);
  };

  // Servis kaydı
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "SERVICE");
    await page.fill('input[name="date"]', gun(-40));
    await page.fill('input[name="vendorName"]', "Bosch Yetkili Servis");
    await page.fill('input[name="cost"]', "1.850,00");
    await page.fill('input[name="note"]', "Pompa değişti");
  });
  await page.waitForSelector("text=Bosch Yetkili Servis");
  log("servis kaydı eklendi");

  // Sayaç okuması
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "READING");
    await page.fill('input[name="date"]', gun(-10));
    await page.fill('input[name="readingValue"]', "128500");
    await page.fill('input[name="readingUnit"]', "km");
  });
  await page.waitForSelector("text=128.500 km");
  log("sayaç okuması eklendi");

  // Zimmet
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "ASSIGNMENT");
    await page.fill('input[name="date"]', gun(-5));
    await page.selectOption('select[name="assignedToUserId"]', { label: "Buket C" });
    await page.fill('input[name="assignedPlace"]', "Şantiye");
  });
  await page.waitForSelector("text=Buket C · Şantiye");
  log("zimmet kaydı eklendi");

  // Günlük
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "LOG");
    await page.fill('input[name="date"]', gun(-1));
    await page.fill('input[name="note"]', "Filtre temizlendi");
  });
  await page.waitForSelector("text=Filtre temizlendi");
  log("olay günlüğü eklendi");
  await page.screenshot({ path: `${out}/1-cizelge.png`, fullPage: true });

  // Sahip olma maliyeti: 18.400,50 + 1.850,00
  const govde = await page.locator("body").innerText();
  if (!govde.includes("20.250,50 ₺")) throw new Error("sahip olma maliyeti yanlış");
  log("sahip olma maliyeti hesaplandı: 20.250,50 ₺");

  // Filtre
  await page.tap('button[role="tab"]:has-text("Servis")');
  await page.waitForTimeout(300);
  const servisGovde = await page.locator("body").innerText();
  if (servisGovde.includes("Filtre temizlendi")) throw new Error("filtre elemedi");
  if (!servisGovde.includes("Bosch Yetkili Servis")) throw new Error("servis kaydı kayboldu");
  log("tür filtresi çalışıyor");

  // Üye olmayan zimmetlenemez
  await page.tap('button[role="tab"]:has-text("Tümü")');
  const itemId = itemUrl.split("/").pop();
  const durum = await page.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/olaylar`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "ASSIGNMENT", date: "2026-03-14", assignedToUserId: "yok-boyle-bir-kullanici" }),
    });
    return { durum: r.status, govde: await r.json() };
  }, itemId);
  if (durum.durum !== 422) throw new Error(`üye olmayana zimmet ${durum.durum} döndü`);
  log("üye olmayana zimmet reddedildi:", durum.govde.hata);

  // Geçersiz sayaç değeri
  const sayac = await page.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/olaylar`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "READING", date: "2026-03-14", readingValue: "abc" }),
    });
    return { durum: r.status, govde: await r.json() };
  }, itemId);
  if (sayac.durum !== 422) throw new Error(`geçersiz sayaç ${sayac.durum} döndü`);
  log("geçersiz sayaç değeri reddedildi:", sayac.govde.hata);

  // Silme
  await page.locator('li:has-text("Filtre temizlendi") button:not([aria-label]):has-text("Sil")').first().click();
  await page.locator('li:has-text("Filtre temizlendi")').waitFor({ state: "detached", timeout: 15000 });
  log("kayıt silindi");

  console.log("\nZAMAN ÇİZELGESİ TESTİ GEÇTİ");
} finally {
  await browser.close();
}
