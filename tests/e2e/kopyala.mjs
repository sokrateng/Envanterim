/**
 * Uzun basınca kopyalama.
 *
 * Kontrol ettiği şey üç şey: başlıkta marka + model + ad tek dizgi olarak
 * kopyalanıyor, seri no satırında **yalnız** seri no kopyalanıyor ve kısa
 * dokunuş panoya hiç dokunmuyor — satıra değen parmak panoyu değiştirmemeli.
 */
import { chromium } from "playwright";
import { BASE, girisYap, iphone, launchOptions, log } from "./ortak.mjs";

const damga = Date.now().toString().slice(-6);
const AD = `Kopyalanan ${damga}`;
const MARKA = "Bosch";
const MODEL = `WGG${damga}`;
const SERI = `SN-${damga}`;

const browser = await chromium.launch(launchOptions);
try {
  const ctx = await browser.newContext(iphone);
  // Pano izni olmadan Chromium okumayı reddediyor; kullanıcı tarafında böyle
  // bir izin sorusu yok, yazma zaten hareketin içinde yapılıyor.
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await girisYap(ctx);

  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.fill('input[name="name"]', AD);
  await page.fill('input[name="brand"]', MARKA);
  await page.fill('input[name="model"]', MODEL);
  await page.fill('input[name="serialNo"]', SERI);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${AD}`, { timeout: 20000 });
  await page.locator(`a:has-text("${AD}")`).first().tap();
  await page.waitForURL(/\/envanter\/[a-z0-9]+/i, { timeout: 15000 });
  await page.waitForTimeout(600);

  const pano = () => page.evaluate(() => navigator.clipboard.readText());

  /** Basılı tut: kopyalama parmak kalkınca yapılıyor (Safari hareket istiyor). */
  async function uzunBas(locator) {
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const box = await locator.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(300);
  }

  // 1) Başlık: marka + model + ad
  await uzunBas(page.locator('div[role="button"]:has(h1)'));
  const baslik = await pano();
  if (baslik !== `${MARKA} ${MODEL} ${AD}`) {
    throw new Error(`başlıktan kopyalanan yanlış: ${baslik}`);
  }
  await page.waitForSelector("text=Ekipman kopyalandı", { timeout: 5000 });
  log("başlıktan marka + model + ad kopyalandı");

  // 2) Seri no: yalnız seri no — servise ya da üreticinin sorgu sayfasına
  //    yapıştırılan şey bu, yanında marka istenmiyor.
  await uzunBas(page.locator('div[role="button"][aria-label^="Seri no:"]'));
  const seri = await pano();
  if (seri !== SERI) throw new Error(`seri nodan kopyalanan yanlış: ${seri}`);
  log("seri nodan yalnız seri no kopyalandı");

  // 3) Marka satırı kendi değerini veriyor
  await uzunBas(page.locator('div[role="button"][aria-label^="Marka:"]'));
  if ((await pano()) !== MARKA) throw new Error("marka satırı kendi değerini vermedi");
  log("her alan kendi değerini kopyalıyor");

  // 4) Kısa dokunuş panoya dokunmamalı
  await page.evaluate(() => navigator.clipboard.writeText("degismedi"));
  const kutu = await page.locator('div[role="button"]:has(h1)').boundingBox();
  await page.touchscreen.tap(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
  await page.waitForTimeout(500);
  if ((await pano()) !== "degismedi") {
    throw new Error("kısa dokunuş panoyu değiştirdi");
  }
  log("kısa dokunuş panoyu değiştirmiyor");

  console.log("\nKOPYALAMA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
