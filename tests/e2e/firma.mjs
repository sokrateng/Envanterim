/**
 * Firmalar: satıcı ve yetkili servis ayrı tanımlanıyor, lokasyondan bağımsız.
 *
 * Kontrol ettiği şey rollerin gerçekten ayrıldığı: yalnız servis olarak
 * tanımlanan firma ekipmanın satıcı listesinde çıkmamalı, tersi de.
 */
import { chromium } from "playwright";
import { BASE, girisYap, iphone, launchOptions, log } from "./ortak.mjs";

const damga = Date.now().toString().slice(-6);
const SERVIS = `Servis Firması ${damga}`;
const SATICI = `Satıcı Firması ${damga}`;

const browser = await chromium.launch(launchOptions);
try {
  const page = await girisYap(await browser.newContext(iphone));

  await page.goto(`${BASE}/hesap/firmalar`);
  await page.waitForSelector('h1:has-text("Firmalar")');

  // 1) Yalnız yetkili servis olan firma
  await page
    .locator('section:has(h2:has-text("Yetkili servisler")) button:has-text("+ Firma")')
    .tap();
  await page.waitForSelector('div[role="dialog"]');
  await page.fill('input[name="name"]', SERVIS);
  await page.fill('input[name="phone"]', "0850 111 22 33");
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${SERVIS}`, { timeout: 20000 });

  const servisBolumu = await page
    .locator('section:has(h2:has-text("Yetkili servisler"))')
    .innerText();
  const saticiBolumu = await page
    .locator('section:has(h2:has-text("Satıcılar"))')
    .innerText();
  if (!servisBolumu.includes(SERVIS)) throw new Error("servis listesinde yok");
  if (saticiBolumu.includes(SERVIS)) throw new Error("servis, satıcı listesinde");
  log("yetkili servis eklendi, satıcı listesine karışmadı");

  // 2) Yalnız satıcı olan firma
  await page
    .locator('section:has(h2:has-text("Satıcılar")) button:has-text("+ Firma")')
    .tap();
  await page.waitForSelector('div[role="dialog"]');
  await page.fill('input[name="name"]', SATICI);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${SATICI}`, { timeout: 20000 });
  log("satıcı eklendi");

  // 3) Ekipman formundaki satıcı listesi: satıcı var, servis yok
  await page.goto(`${BASE}/envanter?yeni=1`);
  await page.waitForSelector('div[role="dialog"] select[name="sellerId"]', {
    timeout: 15000,
  });
  const secenekler = await page
    .locator('select[name="sellerId"] option')
    .allInnerTexts();
  if (!secenekler.some((s) => s.includes(SATICI))) {
    throw new Error("satıcı, ekipman formunda yok");
  }
  if (secenekler.some((s) => s.includes(SERVIS))) {
    throw new Error("servis firması satıcı kutusunda çıkıyor");
  }
  log("ekipman formunda yalnız satıcılar listeleniyor");

  // 4) Ad düzeltme
  await page.goto(`${BASE}/hesap/firmalar`);
  await page.tap(`button:has-text("${SATICI}")`);
  await page.waitForSelector('div[role="dialog"]');
  await page.fill('input[name="name"]', `${SATICI} A.Ş.`);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${SATICI} A.Ş.`, { timeout: 20000 });
  log("firma adı düzeltildi");

  // 5) Kullanılmayan firma silinebiliyor
  await page.tap(`button:has-text("${SERVIS}")`);
  await page.waitForSelector('div[role="dialog"]');
  await page.tap('button:has-text("Firmayı sil")');
  await page.getByRole("button", { name: "Sil", exact: true }).tap();
  await page.waitForSelector(`text=${SERVIS}`, {
    state: "detached",
    timeout: 20000,
  });
  log("kullanılmayan firma silindi");

  console.log("\nFİRMA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
