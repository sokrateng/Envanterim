/**
 * Yeni ekipman formunda faturadan doldurma.
 *
 * Ekipman henüz açılmadan fatura okunuyor: yetki lokasyon üyeliğinden geçiyor,
 * seçilen kalem forma doldurulup kullanıcıya onaylatılıyor ve kaydedince aynı
 * dosya ekipmana belge olarak ekleniyor — kullanıcı iki kez seçmiyor.
 *
 * Sahte Anthropic sunucusu gerekir (tests/e2e/README.md).
 */
import { chromium, devices } from "playwright";
import { bolumAc } from "./ortak.mjs";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/fatura-yeni"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);

const PDF = "/tmp/testfiles/fatura.pdf";
if (!fs.existsSync(PDF)) {
  fs.mkdirSync("/tmp/testfiles", { recursive: true });
  fs.writeFileSync(PDF, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
}

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
  await page.waitForSelector('button:has-text("Faturadan doldur")');
  log("yeni ekipman panelinde faturadan doldurma var");
  await page.screenshot({ path: `${out}/1-panel.png` });

  // Dosya girişi gizli; Playwright gizli girişe de dosya verebiliyor.
  await page.setInputFiles('div[role="dialog"] input[type="file"]', PDF);
  await page.waitForSelector("text=Faturadaki kalemler", { timeout: 30000 });
  log("iki kalem bulundu, seçim paneli açıldı");
  await page.screenshot({ path: `${out}/2-kalemler.png` });

  // Faturada garanti süresi yazmayan kalem: 24 ay varsayılıyor ve alanın
  // altında varsayım olduğu yazıyor. Fatura tarihi 31 Ocak 2026.
  await page.tap('button:has-text("Kurutma makinesi")');
  await page.waitForSelector("text=Alanlar faturadan dolduruldu", { timeout: 10000 });
  const varsayilan = await page.inputValue('input[name="warrantyEndDate"]');
  if (varsayilan !== "2028-01-31") {
    throw new Error(`garanti varsayımı yanlış: ${varsayilan}`);
  }
  const ipucu = await page.locator('label:has-text("Garanti bitişi")').innerText();
  if (!ipucu.includes("önerildi")) {
    throw new Error("varsayım olduğu kullanıcıya söylenmiyor");
  }
  log("garanti süresi yazmayan kalemde 24 ay varsayıldı ve işaretlendi");

  // Baştan alıp faturada süresi yazan kalemle devam: onda varsayım yok.
  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.waitForSelector('button:has-text("Faturadan doldur")');
  await page.setInputFiles('div[role="dialog"] input[type="file"]', PDF);
  await page.waitForSelector("text=Faturadaki kalemler", { timeout: 30000 });
  await page.tap('button:has-text("Çamaşır makinesi")');
  await page.waitForSelector("text=Alanlar faturadan dolduruldu", { timeout: 10000 });
  const faturadan = await page.locator('label:has-text("Garanti bitişi")').innerText();
  if (faturadan.includes("önerildi")) {
    throw new Error("faturada yazan süre varsayım gibi gösteriliyor");
  }

  const gelen = {
    ad: await page.inputValue('input[name="name"]'),
    marka: await page.inputValue('input[name="brand"]'),
    model: await page.inputValue('input[name="model"]'),
    seri: await page.inputValue('input[name="serialNo"]'),
    fiyat: await page.inputValue('input[name="purchasePrice"]'),
    alis: await page.inputValue('input[name="purchaseDate"]'),
    garanti: await page.inputValue('input[name="warrantyEndDate"]'),
  };
  const beklenen = {
    ad: "Çamaşır makinesi", marka: "Bosch", model: "WGG24400TR",
    seri: "FD9901123456", fiyat: "18.400,50", alis: "2026-01-31", garanti: "2028-01-31",
  };
  for (const [k, v] of Object.entries(beklenen)) {
    if (gelen[k] !== v) throw new Error(`${k}: beklenen "${v}", gelen "${gelen[k]}"`);
  }
  log("form faturadan dolduruldu:", JSON.stringify(gelen));
  await page.screenshot({ path: `${out}/3-form.png` });

  // Onaylanmadan kaydedilmiş olmamalı: ad henüz listede yok.
  const etiket = `Çamaşır makinesi ${Date.now()}`;
  await page.fill('input[name="name"]', etiket);
  // Liste sorgusuz çekiliyor: `?q=` metni sayfaya arama kutusunda geri
  // yazıldığı için sorguyla bakmak her hâlde eşleşirdi.
  const oncesi = await page.evaluate(async (q) => {
    const r = await fetch("/envanter", { headers: { "cache-control": "no-cache" } });
    return (await r.text()).includes(q);
  }, etiket);
  if (oncesi) throw new Error("kaydetmeden önce listede görünüyor");

  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${etiket}`, { timeout: 20000 });
  log("kullanıcı onayından sonra kaydedildi");

  // Fatura ekipmana belge olarak da eklenmiş olmalı.
  await page.locator(`a:has-text("${etiket}")`).first().tap();
  // Bölüm kapalı geliyor (docs/TASARIM.md): içine bakmadan önce açılıyor.
  await bolumAc(page, "Fotoğraf ve belgeler");
  const govde = await page.locator("body").innerText();
  for (const metin of ["Bosch", "FD9901123456", "18.400,50 ₺", "fatura.pdf"]) {
    if (!govde.includes(metin)) throw new Error(`eksik: ${metin}`);
  }
  log("fatura ek olarak da yüklendi");
  await page.screenshot({ path: `${out}/4-detay.png` });

  // Üye olmayan kullanıcı lokasyonun okuma ucunu tetikleyemez.
  const yabanciCtx = await browser.newContext(iphone);
  const yabanci = await yabanciCtx.newPage();
  await yabanci.goto(`${BASE}/giris`);
  await yabanci.fill('input[name="username"]', "aysek");
  await yabanci.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await yabanci.tap('button[type="submit"]');
  await yabanci.waitForURL("**/lokasyonlar");

  await page.goto(`${BASE}/lokasyonlar`);
  const href = await page.locator('a[href^="/lokasyonlar/"]').first().getAttribute("href");
  const lokasyonId = href ? href.split("/")[2] : null;
  if (lokasyonId) {
    const durum = await yabanci.evaluate(async (id) => {
      const body = new FormData();
      body.append("file", new File(["%PDF-1.4"], "x.pdf", { type: "application/pdf" }));
      const r = await fetch(`/api/lokasyonlar/${id}/fatura-oku`, { method: "POST", body });
      return r.status;
    }, lokasyonId);
    if (durum === 200) throw new Error("üye olmayan fatura okuyabildi");
    log("üye olmayan lokasyon okuma ucuna erişemiyor:", durum);
  }

  console.log("\nYENİ EKİPMANDA FATURADAN DOLDURMA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
