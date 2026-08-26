import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/rapor"; fs.mkdirSync(out, { recursive: true });
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

  await page.tap('a:has-text("Sigorta raporu")');
  await page.waitForSelector('h1:has-text("Sigorta raporu")');
  await page.waitForSelector("text=envanter raporu");
  // innerText CSS'teki text-transform'u uyguluyor ("TOPLAM ALIŞ DEĞERİ") ve
  // Türkçe "İ" küçültülünce birleşik karaktere dönüşüyor — karşılaştırmayı
  // HTML üstünden yap, orada özgün yazım duruyor.
  const govde = await page.locator("article").innerHTML();
  log("rapor açıldı");

  for (const beklenen of ["Toplam alış değeri", "Sahip olma maliyeti", "Fotoğraflı", "Garantisi süren", "Kategoriye göre", "Ekipmanlar"]) {
    if (!govde.includes(beklenen)) throw new Error(`raporda eksik: ${beklenen}`);
  }
  log("bölümler yerinde");

  // Toplamı veritabanından bağımsız doğrula: CSV çıktısındaki alış tutarları
  const csv = await page.evaluate(async (id) => (await fetch(`/api/lokasyonlar/${id}/csv`)).text(), locationId);
  const satirlar = csv.replace(/^﻿/, "").trim().split("\r\n").slice(1);
  const kolonlar = csv.replace(/^﻿/, "").split("\r\n")[0].split(";");
  const durumIdx = kolonlar.indexOf("Durum");
  const tutarIdx = kolonlar.indexOf("Alış tutarı");
  let beklenenToplam = 0;
  let sayilan = 0;
  for (const satir of satirlar) {
    // Basit ayrıştırma: bu veri kümesinde tırnaklı hücre yok
    const h = satir.split(";");
    if (!["Kullanımda", "Serviste"].includes(h[durumIdx])) continue;
    sayilan += 1;
    const t = h[tutarIdx];
    if (t) beklenenToplam += Math.round(Number(t.replace(/\./g, "").replace(",", ".")) * 100);
  }
  const toplamMetni = beklenenToplam.toString();
  const beklenenBicim = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(beklenenToplam / 100);
  if (!govde.includes(beklenenBicim)) {
    throw new Error(`toplam eşleşmedi: raporda yok → ${beklenenBicim} (${toplamMetni} kuruş)`);
  }
  log("toplam alış değeri CSV ile tutuyor:", beklenenBicim, "₺ ·", sayilan, "ekipman");

  // Emekli ürün rapora girmemeli
  if (govde.includes("Emekli ürün")) throw new Error("emekli ekipman rapora girmiş");
  log("emekli ekipman rapora girmiyor");

  await page.screenshot({ path: `${out}/1-rapor.png`, fullPage: true });

  // Yazdırma görünümü: düğme ve sekme çubuğu gizli
  await page.emulateMedia({ media: "print" });
  const dugme = await page.locator('button:has-text("PDF olarak kaydet")').isVisible().catch(() => false);
  if (dugme) throw new Error("düğme çıktıda görünüyor");
  await page.screenshot({ path: `${out}/2-yazdirma.png`, fullPage: true });
  await page.emulateMedia({ media: "screen" });
  log("yazdırma görünümü temiz");

  // Üye olmayan raporu göremez
  const yabanci = await browser.newContext(iphone);
  const yPage = await yabanci.newPage();
  await yPage.goto(`${BASE}/giris`);
  await yPage.fill('input[name="username"]', "aysek");
  await yPage.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await yPage.tap('button[type="submit"]');
  await yPage.waitForURL("**/lokasyonlar");
  const res = await yPage.goto(`${BASE}/lokasyonlar/${locationId}/rapor`);
  if (res.status() !== 404) throw new Error(`yabancıya ${res.status()} döndü`);
  log("üye olmayan rapora erişemiyor");

  console.log("\nSİGORTA RAPORU TESTİ GEÇTİ");
} finally {
  await browser.close();
}
