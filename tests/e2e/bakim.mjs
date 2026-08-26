import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/bakim"; fs.mkdirSync(out, { recursive: true });
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

  // Araç: sayaç kuralı için
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const arac = `Araç ${damga}`;
  await page.fill('input[name="name"]', arac);
  await page.fill('input[name="purchaseDate"]', gun(-400));
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${arac}`);
  await page.locator(`a:has-text("${arac}")`).first().click();
  await page.waitForSelector('button:has-text("+ Kural")');
  const aracUrl = page.url();

  // Sayaç kuralı: her 10.000 km
  await page.tap('button:has-text("+ Kural")');
  await page.fill('input[name="name"]', "Periyodik bakım");
  await page.selectOption('select:near(:text("Neye göre"))', "reading");
  await page.fill('input[name="everyReading"]', "10000");
  await page.fill('input[name="readingUnit"]', "km");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Periyodik bakım", { timeout: 15000 });
  let govde = await page.locator("body").innerHTML();
  if (!govde.includes("Veri eksik")) throw new Error("okuma yokken durum 'Veri eksik' olmalı");
  log("sayaç kuralı eklendi; okuma yokken veri eksik diyor");

  // İki okuma: 100.000 ve 105.000 km
  const kayit = async (doldur) => {
    await page.tap('button:has-text("+ Kayıt")');
    await doldur();
    await page.tap('form button[type="submit"]');
    await page.waitForTimeout(1500);
  };
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "READING");
    await page.fill('input[name="date"]', gun(-60));
    await page.fill('input[name="readingValue"]', "100000");
    await page.fill('input[name="readingUnit"]', "km");
  });
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "READING");
    await page.fill('input[name="date"]', gun(-2));
    await page.fill('input[name="readingValue"]', "105000");
    await page.fill('input[name="readingUnit"]', "km");
  });
  await page.goto(aracUrl);
  govde = await page.locator("body").innerHTML();
  if (!govde.includes("5.000 km kaldı")) throw new Error("kalan km yanlış: " + govde.match(/[\d.]+ km [a-zğüşiöç]+/i));
  log("iki okumadan sonra: 5.000 km kaldı");

  // Sınırı aş: 112.000 km
  await kayit(async () => {
    await page.selectOption('select:near(:text("Tür"))', "READING");
    await page.fill('input[name="date"]', gun(-1));
    await page.fill('input[name="readingValue"]', "112000");
    await page.fill('input[name="readingUnit"]', "km");
  });
  await page.goto(aracUrl);
  govde = await page.locator("body").innerHTML();
  if (!govde.includes("Zamanı geldi") || !govde.includes("2.000 km geçildi")) {
    throw new Error("aşım durumu yanlış");
  }
  log("sınır aşılınca: zamanı geldi, 2.000 km geçildi");
  await page.screenshot({ path: `${out}/1-bakim.png`, fullPage: true });

  // Zaman kuralı: 6 ayda bir, alış 400 gün önce → gecikmiş
  await page.tap('button:has-text("+ Kural")');
  await page.fill('input[name="name"]', "Klima bakımı");
  await page.fill('input[name="everyMonths"]', "6");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Klima bakımı", { timeout: 15000 });
  govde = await page.locator("body").innerHTML();
  if (!govde.includes("gün gecikti")) throw new Error("zaman kuralı gecikmeyi göstermiyor");
  log("zaman kuralı gecikmeyi gösteriyor");

  // Cron: iki kural için bildirim gitmeli, ikinci koşuda gitmemeli
  const oncekiPush = fs.readFileSync("/tmp/mock-push.log", "utf8").trim().split("\n").filter(Boolean).length;
  const birinci = await page.evaluate(async () => (await fetch("/api/cron/garanti", { headers: { authorization: "Bearer gizli-cron" } })).json());
  const sonrakiPush = fs.readFileSync("/tmp/mock-push.log", "utf8").trim().split("\n").filter(Boolean).length;
  if (birinci.bakim.gonderilen < 2) throw new Error("bakım bildirimi gitmedi: " + JSON.stringify(birinci.bakim));
  if (sonrakiPush <= oncekiPush) throw new Error("push servisine istek gitmedi");
  log("cron bakım bildirimi gönderdi:", JSON.stringify(birinci.bakim));

  const ikinci = await page.evaluate(async () => (await fetch("/api/cron/garanti", { headers: { authorization: "Bearer gizli-cron" } })).json());
  if (ikinci.bakim.gonderilen !== 0) throw new Error("ikinci koşuda tekrar gönderdi: " + JSON.stringify(ikinci.bakim));
  if (ikinci.bakim.atlanan < 2) throw new Error("atlama sayısı yanlış");
  log("ikinci koşuda tekrar göndermedi (damga çalışıyor)");

  // Kural silme
  await page.goto(aracUrl);
  await page.locator('li:has-text("Klima bakımı") button:has-text("Sil")').first().click();
  await page.locator('li:has-text("Klima bakımı")').waitFor({ state: "detached", timeout: 15000 });
  log("kural silindi");

  // Ay ve sayaç ikisi de boşsa reddedilir
  const itemId = aracUrl.split("/").pop();
  const durum = await page.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/bakim`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Boş kural" }),
    });
    return { durum: r.status, govde: await r.json() };
  }, itemId);
  if (durum.durum !== 422) throw new Error(`boş kurala ${durum.durum} döndü`);
  log("aralıksız kural reddedildi:", durum.govde.hata);

  console.log("\nBAKIM KURALI TESTİ GEÇTİ");
} finally {
  await browser.close();
}
