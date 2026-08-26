import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/csv"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const damga = Date.now();

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ ...iphone, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.locator('a[href^="/lokasyonlar/"]').first().click();
  await page.waitForURL(/\/lokasyonlar\/[^/]+$/);
  const locUrl = page.url();
  const locationId = locUrl.split("/").pop();
  await page.waitForSelector('a:has-text("CSV")');
  await page.tap('a:has-text("CSV")');
  await page.waitForSelector('h1:has-text("CSV")');
  log("CSV sayfası açıldı");

  // Dışa aktarma
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('a:has-text("CSV indir")').click(),
  ]);
  const yol = `/tmp/disa-${damga}.csv`;
  await download.saveAs(yol);
  const icerik = fs.readFileSync(yol, "utf8");
  if (!icerik.startsWith("﻿")) throw new Error("BOM yok — Excel Türkçe karakteri bozar");
  const basliklar = icerik.replace(/^﻿/, "").split("\r\n")[0];
  if (!basliklar.includes("Seri no;") || !basliklar.includes("Sahip olma maliyeti")) {
    throw new Error("başlıklar eksik: " + basliklar);
  }
  const satirSayisi = icerik.trim().split("\r\n").length - 1;
  log("dışa aktarıldı:", satirSayisi, "satır ·", download.suggestedFilename());
  await page.screenshot({ path: `${out}/1-csv.png` });

  // İçe aktarma: hatalı satır içeren dosya
  const giris = [
    "﻿Ad;Marka;Seri no;Kategori;Durum;Alış tarihi;Alış tutarı;Garanti bitişi",
    `Mikrodalga ${damga};Arçelik;MW-${damga};Küçük ev aleti;Kullanımda;14.03.2026;3.499,90;14.03.2028`,
    `Ütü ${damga};Philips;;Küçük ev aleti;Serviste;;;`,
    ";Marka var ama ad yok;;;;;;",
    `Bozuk tarih ${damga};X;;;Kullanımda;dün;;`,
  ].join("\r\n");
  const girisYolu = `/tmp/ice-${damga}.csv`;
  fs.writeFileSync(girisYolu, giris);

  await page.setInputFiles('input[type="file"]', girisYolu);
  await page.waitForSelector('button:has-text("Önizle")');
  await page.tap('button:has-text("Önizle")');
  await page.waitForSelector("text=eklenmeye hazır", { timeout: 15000 });
  const onizleme = await page.locator("body").innerText();
  if (!onizleme.includes("2 satır eklenmeye hazır")) throw new Error("önizleme sayısı yanlış: " + onizleme.slice(0, 300));
  if (!onizleme.includes("Ad boş")) throw new Error("hatalı satır bildirilmedi");
  if (!onizleme.includes("Alış tarihi okunamadı")) throw new Error("bozuk tarih bildirilmedi");
  log("önizleme doğru: 2 hazır, 2 hatalı satır ayrı ayrı bildirildi");
  await page.screenshot({ path: `${out}/2-onizleme.png` });

  // Onay öncesi hiçbir şey kaydedilmemeli: dosya birebir aynı kalmalı.
  const onizlemeSonrasi = await page.evaluate(async (id) => {
    const r = await fetch(`/api/lokasyonlar/${id}/csv`);
    return await r.text();
  }, locationId);
  // fetch().text() BOM'u çözerken atıyor; karşılaştırmadan önce iki taraftan da at.
  const bomsuz = (t) => t.replace(/^\ufeff/, "");
  if (bomsuz(onizlemeSonrasi) !== bomsuz(icerik)) {
    const a = icerik, b = onizlemeSonrasi;
    let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i += 1;
    console.log("uzunluk:", a.length, b.length, "| ilk fark:", i);
    console.log("A:", JSON.stringify(a.slice(Math.max(0, i - 60), i + 60)));
    console.log("B:", JSON.stringify(b.slice(Math.max(0, i - 60), i + 60)));
    throw new Error("onaydan önce kayıt olmuş");
  }
  log("onaydan önce hiçbir şey kaydedilmedi");

  await page.tap('button:has-text("ekipmanı ekle")');
  await page.waitForSelector("text=ekipman eklendi", { timeout: 20000 });
  log("onaydan sonra eklendi");

  // Eklenenler gerçekten var mı ve kategori açıldı mı
  await page.goto(`${BASE}/envanter?q=Mikrodalga ${damga}`);
  await page.waitForSelector(`text=Mikrodalga ${damga}`);
  await page.locator(`a:has-text("Mikrodalga ${damga}")`).first().click();
  await page.waitForSelector(`h1:has-text("Mikrodalga ${damga}")`);
  const detay = await page.locator("body").innerText();
  for (const beklenen of ["Arçelik", `MW-${damga}`, "Küçük ev aleti", "3.499,90 ₺", "14 Mart 2028"]) {
    if (!detay.includes(beklenen)) throw new Error(`içe aktarmada eksik: ${beklenen}`);
  }
  log("içe aktarılan ekipmanın alanları doğru");
  await page.screenshot({ path: `${out}/3-eklenen.png` });

  // Görüntüleyen içe aktaramaz
  const viewer = await browser.newContext(iphone);
  const vPage = await viewer.newPage();
  await vPage.goto(`${BASE}/giris`);
  await vPage.fill('input[name="username"]', "aysek");
  await vPage.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await vPage.tap('button[type="submit"]');
  await vPage.waitForURL("**/lokasyonlar");
  const durum = await vPage.evaluate(async (id) => {
    const body = new FormData();
    body.append("file", new File(["Ad\nX"], "a.csv", { type: "text/csv" }));
    const r = await fetch(`/api/lokasyonlar/${id}/csv`, { method: "POST", body });
    return r.status;
  }, locationId);
  if (durum !== 404) throw new Error(`üye olmayana ${durum} döndü`);
  log("üye olmayan içe aktaramıyor");

  console.log("\nCSV TESTİ GEÇTİ");
} finally {
  await browser.close();
}
