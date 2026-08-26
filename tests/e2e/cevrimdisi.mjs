/**
 * Çevrimdışı: service worker kayıtlı mı, daha önce açılan sayfa ağsız
 * görünüyor mu, hiç açılmamış adres /cevrimdisi'ye mi düşüyor, API önbelleğe
 * giriyor mu, çıkışta önbellek temizleniyor mu.
 *
 * Ağ `context.setOffline` ile değil **yönlendirmeyle** kesiliyor: setOffline
 * service worker'ın kendi `fetch`'ine ulaşmıyor, istek sunucuya gidiyor ve
 * test hiçbir şeyi kanıtlamıyor (TUZAKLAR #47).
 */
import { chromium } from "playwright";
import { BASE, girisYap, iphone, launchOptions, log } from "./ortak.mjs";

const browser = await chromium.launch(launchOptions);

try {
  const context = await browser.newContext(iphone);
  const page = await girisYap(context);

  // Service worker uygulama açılınca kaydolmalı — bildirim izni olmadan da.
  await page.goto(`${BASE}/envanter`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 20_000,
  });
  log("service worker kayıtlı ve sayfayı yönetiyor");

  // Sayfalar gezilsin ki önbelleğe girsin: biri doğrudan, biri tıklayarak.
  await page.reload();
  await page.locator('a[href^="/envanter/"]').first().tap();
  await page.waitForURL(/\/envanter\/[^/?#]+$/);
  const urunAdi = await page.locator("h1").first().innerText();
  await page.goto(`${BASE}/envanter`);
  log("iki sayfa gezildi");

  // API yanıtı önbelleğe girmemeli.
  const apiOnbellekte = await page.evaluate(async () => {
    const adlar = await caches.keys();
    for (const ad of adlar) {
      const cache = await caches.open(ad);
      const anahtarlar = await cache.keys();
      if (anahtarlar.some((istek) => new URL(istek.url).pathname.startsWith("/api/"))) {
        return true;
      }
    }
    return false;
  });
  if (apiOnbellekte) throw new Error("API yanıtı önbelleğe girmiş");
  log("API önbelleğe girmiyor");

  // Ağı kes: service worker'ın isteği de dahil.
  await context.route("**/*", (route) => route.abort());

  // (a) Doğrudan açılmış adres belge önbelleğinden gelmeli.
  await page.goto(`${BASE}/envanter`);
  await page.waitForSelector('h1:has-text("Envanter")');
  log("ağsızken envanter listesi önbellekten geldi");

  // (b) Uygulama içinde tıklayarak gezinme RSC önbelleğinden gelmeli.
  await page.locator('a[href^="/envanter/"]').first().tap();
  await page.waitForURL(/\/envanter\/[^/?#]+$/, { timeout: 20_000 });
  const cevrimdisiBaslik = await page.locator("h1").first().innerText();
  if (cevrimdisiBaslik !== urunAdi) {
    throw new Error(`ürün sayfası gelmedi: ${cevrimdisiBaslik}`);
  }
  log("ağsızken tıklayarak ürün sayfası açıldı:", cevrimdisiBaslik);

  // (c) Hiç açılmamış adres çevrimdışı sayfasına düşmeli.
  await page.goto(`${BASE}/lokasyonlar/olmayan-bir-adres-12345`);
  await page.waitForSelector('h1:has-text("Bağlantı yok")');
  log("hiç açılmamış adres çevrimdışı sayfasına düştü");

  await context.unroute("**/*");

  // Çıkışta önbellek temizlenmeli: ortak cihazda başkasının envanteri kalmasın.
  await page.goto(`${BASE}/hesap`);
  await page.tap('button:has-text("Çıkış yap")');
  await page.waitForURL("**/giris", { timeout: 20_000 });
  await page.waitForFunction(async () => (await caches.keys()).length === 0, null, {
    timeout: 20_000,
  });
  log("çıkışta önbellek temizlendi");

  console.log("\nÇEVRİMDIŞI TESTİ GEÇTİ");
} finally {
  await browser.close();
}
