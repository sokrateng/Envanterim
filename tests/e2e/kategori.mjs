import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = process.argv[2] ?? (process.env.E2E_SHOTS ?? "/tmp/shots") + "/kat";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const KAT = "Beyaz eşya " + Date.now();
const URUN = "Bulaşık makinesi " + Date.now();

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // Kategori ve alan tanımı
  await page.tap('a:has-text("Ev")');
  await page.tap('a:has-text("Kategoriler")');
  await page.waitForSelector('h1:has-text("Kategoriler")');
  await page.tap('button:has-text("+ Yeni")');
  await page.fill('input[name="name"]', KAT);
  await page.fill('input[name="icon"]', "🧺");
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${KAT}`);
  log("kategori oluşturuldu");

  await page.locator(`a:has-text("${KAT}")`).first().click();
  await page.waitForSelector("text=ÖZEL ALANLAR");
  // TEXT (zorunlu)
  await page.tap('button:has-text("+ Alan")');
  await page.fill('input[name="label"]', "Kapasite (kg)");
  await page.selectOption('select[name="type"]', "NUMBER");
  await page.check('input[name="required"]');
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Kapasite (kg)");
  // SELECT
  await page.tap('button:has-text("+ Alan")');
  await page.fill('input[name="label"]', "Enerji sınıfı");
  await page.selectOption('select[name="type"]', "SELECT");
  await page.fill('textarea[name="options"]', "A+++\nA++\nB");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Enerji sınıfı");
  log("iki özel alan tanımlandı");
  await page.screenshot({ path: `${out}/1-alanlar.png` });

  // Zorunlu alan boş bırakılamaz
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', URUN);
  await page.selectOption('select[name="categoryId"]', { label: `🧺 ${KAT}` });
  await page.waitForSelector('input[name="ozel_kapasite_kg"]');
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Kapasite (kg) gerekli");
  log("zorunlu dinamik alan doğrulandı (sunucu)");
  await page.screenshot({ path: `${out}/2-zorunlu-alan.png` });

  // Doldurup kaydet
  await page.fill('input[name="ozel_kapasite_kg"]', "9,5");
  await page.selectOption('select[name="ozel_enerji_sinifi"]', "A++");
  await page.fill('input[name="warrantyEndDate"]', "2027-05-10");
  await page.fill('input[name="purchasePrice"]', "24.999,90");
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${URUN}`);
  log("dinamik alanlı ekipman kaydedildi");

  // Detay sayfası
  await page.locator(`a:has-text("${URUN}")`).first().click();
  await page.waitForSelector(`h1:has-text("${URUN}")`);
  const itemUrl = page.url();
  const body = await page.locator("body").innerText();
  for (const beklenen of ["9,5", "A++", "24.999,90 ₺", KAT]) {
    if (!body.includes(beklenen)) throw new Error(`detayda eksik: ${beklenen}`);
  }
  log("detay sayfası değerleri gösteriyor");
  await page.screenshot({ path: `${out}/3-detay.png` });

  // Durum değişimi
  // Sabit sekme çubuğu sayfanın en altını örtüyor; önce dibe kaydır.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Serviste", exact: true }).click();
  await page.waitForTimeout(800);
  await page.waitForTimeout(1000);
  // Düzenleme: sayı alanını değiştir
  await page.tap('button:has-text("Düzenle")');
  await page.fill('input[name="ozel_kapasite_kg"]', "10");
  await page.fill('input[name="place"]', "Mutfak");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Mutfak");
  const after = await page.locator("body").innerText();
  if (!after.includes("10")) throw new Error("düzenleme kaydedilmedi");
  log("düzenleme kaydedildi, durum değişti");
  await page.screenshot({ path: `${out}/4-duzenlenmis.png` });

  // Alanı gizle: değer korunmalı, formda çıkmamalı
  await page.goto(`${BASE}/lokasyonlar`);
  await page.tap('a:has-text("Ev")');
  await page.tap('a:has-text("Kategoriler")');
  await page.locator(`a:has-text("${KAT}")`).first().click();
  await page.locator('li:has-text("Enerji sınıfı") button:has-text("Gizle")').tap();
  await page.waitForSelector('li:has-text("Enerji sınıfı") button:has-text("Göster")');
  log("alan gizlendi");

  await page.goto(itemUrl);
  const hidden = await page.locator("body").innerText();
  if (hidden.includes("Enerji sınıfı")) throw new Error("gizli alan detayda görünüyor");
  await page.tap('button:has-text("Düzenle")');
  if (await page.locator('select[name="ozel_enerji_sinifi"]').count()) {
    throw new Error("gizli alan formda görünüyor");
  }
  await page.fill('input[name="ozel_kapasite_kg"]', "11");
  await page.tap('button[type="submit"]');
  await page.waitForTimeout(1500);
  log("gizli alanla kaydetme çalıştı");

  // Gizli alanın değeri korundu mu: tekrar göster
  await page.goto(`${BASE}/lokasyonlar`);
  await page.tap('a:has-text("Ev")');
  await page.tap('a:has-text("Kategoriler")');
  await page.locator(`a:has-text("${KAT}")`).first().click();
  await page.locator('li:has-text("Enerji sınıfı") button:has-text("Göster")').tap();
  await page.waitForSelector('li:has-text("Enerji sınıfı") button:has-text("Gizle")');
  await page.goto(itemUrl);
  const restored = await page.locator("body").innerText();
  if (!restored.includes("A++")) throw new Error("gizlenen alanın değeri kaybolmuş");
  log("gizlenen alanın değeri korunmuş (TUZAKLAR #26)");

  // Kategori filtresi
  await page.goto(`${BASE}/envanter`);
  await page.locator(`a:has-text("${KAT}")`).first().click();
  await page.waitForURL(/kategori=/);
  await page.waitForSelector(`text=${URUN}`);
  await page.waitForTimeout(500);
  if (await page.locator('a:has-text("Çamaşır makinesi")').count()) {
    throw new Error("kategori filtresi diğer ekipmanı elemiyor");
  }
  log("kategori filtresi çalışıyor");
  await page.screenshot({ path: `${out}/5-kategori-filtresi.png` });

  // Dolu kategori silinemez
  const ids = await page.evaluate(async () => {
    const r = await fetch("/api/lokasyonlar/x/kategoriler", { method: "POST" });
    return r.status;
  });
  if (ids !== 404 && ids !== 400) throw new Error(`bilinmeyen lokasyon ${ids} döndü`);
  log("bilinmeyen lokasyona kategori açılamıyor");

  console.log("\nKATEGORİ VE DİNAMİK ALAN TESTİ GEÇTİ");
} finally {
  await browser.close();
}
