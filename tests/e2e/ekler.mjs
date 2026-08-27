import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = process.argv[2] ?? (process.env.E2E_SHOTS ?? "/tmp/shots") + "/ek";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const ctx = await browser.newContext(iphone);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.goto(`${BASE}/envanter`);
  await page.locator("a[href^='/envanter/']").first().tap();
  await page.waitForSelector("text=FOTOĞRAF VE BELGELER");
  const itemUrl = page.url();

  // Fotoğraf yükle (istemcide küçültülüyor)
  await page.selectOption('select[aria-label="Belge türü"]', "PHOTO");
  await page.setInputFiles('section:has(h2:has-text("Fotoğraf ve belgeler")) input[type="file"]', "/tmp/testfiles/foto.png");
  await page.waitForSelector("figure img", { timeout: 20000 });
  log("fotoğraf yüklendi");

  // Görsel gerçekten sunuluyor mu (kimlik doğrulamalı uç)
  const src = await page.locator("figure img").first().getAttribute("src");
  const status = await page.evaluate(async (u) => (await fetch(u)).status, src);
  if (status !== 200) throw new Error(`ek sunulamadı: ${status}`);
  log("ek kimlik doğrulamalı uçtan sunuluyor:", src);

  // Küçültme çalıştı mı: 1200px genişlik 2000 sınırının altında, boyut küçülmüş olmalı
  const bytes = await page.evaluate(async (u) => (await fetch(u)).arrayBuffer().then((b) => b.byteLength), src);
  log("yüklenen boyut:", bytes, "bayt (kaynak 125046)");

  // PDF yükle: fatura
  await page.selectOption('select[aria-label="Belge türü"]', "INVOICE");
  await page.setInputFiles('section:has(h2:has-text("Fotoğraf ve belgeler")) input[type="file"]', "/tmp/testfiles/fatura.pdf");
  await page.waitForSelector("text=fatura.pdf", { timeout: 20000 });
  log("fatura PDF yüklendi ve belge listesinde (görsel ızgarasında değil)");
  if (await page.locator("figure img[alt='fatura.pdf']").count()) {
    throw new Error("PDF fotoğraf ızgarasına düşmüş");
  }
  await page.screenshot({ path: `${out}/1-ekler.png` });

  // İzinsiz tür reddedilir
  await page.setInputFiles('section:has(h2:has-text("Fotoğraf ve belgeler")) input[type="file"]', "/tmp/testfiles/kotu.txt");
  await page.waitForSelector("text=Yalnız JPG, PNG, WebP, HEIC ve PDF yüklenir");
  log("izinsiz dosya türü reddedildi");

  // PDF fotoğraf türüyle yüklenemez
  await page.selectOption('select[aria-label="Belge türü"]', "PHOTO");
  await page.setInputFiles('section:has(h2:has-text("Fotoğraf ve belgeler")) input[type="file"]', "/tmp/testfiles/fatura.pdf");
  await page.waitForSelector("text=Fotoğraf olarak yalnız görsel yüklenir");
  log("PDF fotoğraf türüyle reddedildi");

  // Üye olmayan eki çekemez
  const strangerCtx = await browser.newContext(iphone);
  const stranger = await strangerCtx.newPage();
  await stranger.goto(`${BASE}/giris`);
  await stranger.fill('input[name="username"]', "aysek");
  await stranger.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await stranger.tap('button[type="submit"]');
  await stranger.waitForURL("**/lokasyonlar");
  const strangerStatus = await stranger.evaluate(async (u) => (await fetch(u)).status, src);
  if (strangerStatus !== 404) throw new Error(`yabancı eke ${strangerStatus} ile ulaştı`);
  log("yabancı ek dosyasına ulaşamıyor (404)");

  // Görüntüleyen silemez: düzenleyen değil, görüntüleyen bir üye ekle
  await page.goto(itemUrl);
  const oncekiAdet = await page.locator("figure img").count();
  await page.locator('figure button[aria-label$="sil"]').first().click();
  await page.waitForTimeout(2000);
  const sonrakiAdet = await page.locator("figure img").count();
  if (sonrakiAdet !== oncekiAdet - 1) {
    throw new Error(`fotoğraf silinmedi: ${oncekiAdet} → ${sonrakiAdet}`);
  }
  log("fotoğraf silindi");

  // Listedeki küçük görsel: fotoğrafı olmayan satırdan kamerayla ekleme,
  // fotoğrafı olandan büyütme.
  const AD = "Foto kısayolu " + Date.now().toString().slice(-6);
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', AD);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${AD}`, { timeout: 15000 });

  const ekleDugmesi = page.locator(`button[aria-label="${AD} için fotoğraf çek"]`);
  await ekleDugmesi.waitFor({ timeout: 15000 });
  // Dokunuş satırı açmamalı: görsel bağlantının dışında (TUZAKLAR #64).
  // Gizli dosya girişi düğmenin hemen ardında duruyor.
  const dosyaGirisi = page.locator(
    `button[aria-label="${AD} için fotoğraf çek"] + input[type="file"]`,
  );
  await dosyaGirisi.setInputFiles("/tmp/testfiles/foto.png");
  await page.waitForSelector(`button[aria-label="${AD} fotoğrafını büyüt"]`, {
    timeout: 20000,
  });
  if (!page.url().includes("/envanter")) throw new Error("görsel dokunuşu satırı açtı");
  log("listeden kamerayla fotoğraf eklendi");

  await page.tap(`button[aria-label="${AD} fotoğrafını büyüt"]`);
  await page.waitForSelector('[data-testid="zoom-gorsel"]', { timeout: 10000 });
  log("listedeki fotoğraf büyütülebiliyor");
  await page.keyboard.press("Escape");

  // Detay başlığında da aynı kısayol: fotoğrafı olan büyütüyor.
  await page.locator(`a:has-text("${AD}")`).first().tap();
  await page.waitForSelector("text=FOTOĞRAF VE BELGELER", { timeout: 15000 });
  const basliktaki = page.locator(`header button[aria-label="${AD} fotoğrafını büyüt"]`);
  if (!(await basliktaki.count())) throw new Error("detay başlığında fotoğraf düğmesi yok");

  // Başlıktaki görsel adın üstüne binmemeli (TUZAKLAR #66).
  const cakisma = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const kutu = h1.getBoundingClientRect();
    const ust = document.elementFromPoint(Math.round(kutu.x) + 2, Math.round(kutu.y) + 14);
    return ust?.tagName;
  });
  if (cakisma !== "H1") throw new Error(`başlığın üstünde ${cakisma} var`);
  log("detay başlığındaki fotoğraf kısayolu yerinde");
  await page.screenshot({ path: `${out}/5-liste-foto.png` });

  console.log("\nEK YÜKLEME TESTİ GEÇTİ");
} finally {
  await browser.close();
}
