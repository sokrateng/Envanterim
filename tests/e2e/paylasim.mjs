import { chromium, devices } from "playwright";
import fs from "node:fs";
import { bolumAc } from "./ortak.mjs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/paylasim"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const gun = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const damga = Date.now();

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // Servis geçmişi, fotoğrafı ve tutarı olan bir ekipman
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const ad = `Kombi ${damga}`;
  await page.fill('input[name="name"]', ad);
  await page.fill('input[name="brand"]', "Vaillant");
  await page.fill('input[name="serialNo"]', `SN-${damga}`);
  await page.fill('input[name="purchasePrice"]', "42.750,00");
  await page.fill('input[name="warrantyEndDate"]', gun(200));
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad}`);
  await page.locator(`a:has-text("${ad}")`).first().click();
  await bolumAc(page, "Salt-okunur bağlantı");
  const itemUrl = page.url();

  // Tutarlı bir servis kaydı ekle
  await page.tap('button:has-text("+ Kayıt")');
  await page.selectOption('select:near(:text("Tür"))', "SERVICE");
  await page.fill('input[name="date"]', gun(-30));
  await page.fill('input[name="vendorName"]', "Vaillant Yetkili Servis");
  await page.fill('input[name="cost"]', "1.250,00");
  await page.fill('input[name="note"]', "Yıllık bakım yapıldı");
  await page.tap('form button[type="submit"]');
  await page.waitForSelector("text=Vaillant Yetkili Servis", { timeout: 15000 });

  // Fotoğraf ekle: paylaşılan sayfada görünmeli
  await page.goto(itemUrl);
  await bolumAc(page, "Fotoğraf ve belgeler");
  await page.selectOption('select[aria-label="Belge türü"]', "PHOTO");
  await page.setInputFiles('input[type="file"]', "/tmp/testfiles/foto.png");
  await page.waitForSelector("figure img", { timeout: 20000 });

  // Bağlantı üret
  await page.goto(itemUrl);
  await bolumAc(page, "Salt-okunur bağlantı");
  await page.selectOption('select[aria-label="Bağlantı süresi"]', "7");
  await page.tap('button:has-text("Bağlantı üret")');
  await page.waitForSelector("text=görüntüleme", { timeout: 15000 });
  const govde = await page.locator("body").innerHTML();
  const eslesme = govde.match(/\/p\/([0-9a-f]{8})…/);
  if (!eslesme) throw new Error("bağlantı listede görünmüyor");
  log("bağlantı üretildi:", eslesme[1] + "…");
  await page.screenshot({ path: `${out}/1-baglantilar.png`, fullPage: true });

  // Tam anahtarı veritabanı yerine listeden alamayız; API'den üret ve kullan
  const itemId = itemUrl.split("/").pop();
  const yeni = await page.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/paylasim`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ gun: 7 }),
    });
    return r.json();
  }, itemId);
  if (!/^[0-9a-f]{32}$/.test(yeni.token)) throw new Error("anahtar biçimi yanlış: " + yeni.token);
  log("anahtar 32 haneli onaltılık");

  // Girişsiz tarayıcıda aç
  const anonim = await browser.newContext(iphone);
  const anonPage = await anonim.newPage();
  const res = await anonPage.goto(`${BASE}/p/${yeni.token}`);
  if (res.status() !== 200) throw new Error(`paylaşım sayfası ${res.status()} döndü`);
  await anonPage.waitForSelector(`h1:has-text("${ad}")`);
  const paylasim = await anonPage.locator("body").innerHTML();

  for (const beklenen of ["Vaillant", `SN-${damga}`, "Vaillant Yetkili Servis", "Yıllık bakım yapıldı", "Geçmiş"]) {
    if (!paylasim.includes(beklenen)) throw new Error(`paylaşımda eksik: ${beklenen}`);
  }
  log("girişsiz açıldı; ekipman ve servis geçmişi görünüyor");

  // Tutarlar paylaşılmamalı
  for (const gizli of ["42.750", "1.250,00", "Sahip olma maliyeti", "Alış tutarı"]) {
    if (paylasim.includes(gizli)) throw new Error(`tutar sızdı: ${gizli}`);
  }
  log("tutarlar paylaşılmıyor");

  // Fotoğraf teknisyene de açılmalı (dosya ucu normalde üyelik ister)
  const fotoSrc = await anonPage.locator("main img").first().getAttribute("src");
  if (!fotoSrc) throw new Error("paylaşılan sayfada fotoğraf yok");
  const fotoDurum = await anonPage.evaluate(async (u) => (await fetch(u)).status, fotoSrc);
  if (fotoDurum !== 200) throw new Error(`paylaşılan fotoğraf ${fotoDurum} döndü`);
  log("fotoğraf paylaşım anahtarıyla açılıyor:", fotoSrc.slice(0, 40) + "…");

  // Anahtarsız aynı dosya kapalı kalmalı
  const anahtarsiz = fotoSrc.split("?")[0];
  const kapali = await anonPage.evaluate(async (u) => (await fetch(u)).status, anahtarsiz);
  if (kapali === 200) throw new Error("anahtarsız dosya açık kaldı");
  log("anahtarsız aynı dosya kapalı:", kapali);

  // Başka ekipmanın dosyası bu anahtarla açılmamalı
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', `Başka ekipman ${damga}`);
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=Başka ekipman ${damga}`);
  await page.locator(`a:has-text("Başka ekipman ${damga}")`).first().click();
  await bolumAc(page, "Fotoğraf ve belgeler");
  await page.selectOption('select[aria-label="Belge türü"]', "PHOTO");
  await page.setInputFiles('input[type="file"]', "/tmp/testfiles/foto.png");
  await bolumAc(page, "Fotoğraf ve belgeler");
  await page.waitForSelector("figure img", { timeout: 20000 });
  const baskaSrc = await page.locator("figure img").first().getAttribute("src");

  const capraz = await anonPage.evaluate(
    async ({ url, token }) => (await fetch(`${url}?p=${token}`)).status,
    { url: baskaSrc, token: yeni.token },
  );
  if (capraz === 200) throw new Error("anahtar başka ekipmanın dosyasını açtı");
  log("anahtar yalnız kendi ekipmanının dosyasını açıyor (çapraz erişim", capraz + ")");

  // Arama motoruna kapalı
  const robots = await anonPage.locator('meta[name="robots"]').getAttribute("content");
  if (!robots || !robots.includes("noindex")) throw new Error("noindex yok: " + robots);
  log("noindex var:", robots);
  await anonPage.screenshot({ path: `${out}/2-paylasilan.png`, fullPage: true });

  // Görüntülenme sayacı işliyor
  await page.goto(itemUrl);
  await page.reload();
  await bolumAc(page, "Salt-okunur bağlantı");
  // innerHTML'de React bitişik metin düğümleri arasına <!-- --> koyuyor
  // ("1<!-- --> görüntüleme"); sayaç kontrolü innerText üstünden yapılmalı.
  const sayac = await page.locator("body").innerText();
  if (!sayac.includes("1 görüntüleme")) throw new Error("görüntülenme sayacı işlemedi");
  log("görüntülenme sayacı işliyor");

  // Uydurma anahtar 404
  const sahte = await anonPage.goto(`${BASE}/p/${"a".repeat(32)}`);
  if (sahte.status() !== 404) throw new Error(`uydurma anahtara ${sahte.status()} döndü`);
  const kisa = await anonPage.goto(`${BASE}/p/kisa`);
  if (kisa.status() !== 404) throw new Error("biçimsiz anahtar 404 dönmedi");
  log("uydurma ve biçimsiz anahtar 404");

  // İptal edilen bağlantı anında geçersiz
  await page.goto(itemUrl);
  await bolumAc(page, "Salt-okunur bağlantı");
  await page.locator('li:has-text("Geçerli") button:has-text("İptal")').first().click();
  await page.waitForTimeout(2000);
  const iptalSonrasi = await anonPage.goto(`${BASE}/p/${yeni.token}`);
  if (iptalSonrasi.status() !== 404) throw new Error(`iptalden sonra ${iptalSonrasi.status()} döndü`);
  log("iptal edilen bağlantı 404");

  console.log("\nPAYLAŞIM LİNKİ TESTİ GEÇTİ");
} finally {
  await browser.close();
}
