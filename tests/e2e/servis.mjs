/**
 * Yetkili servis kayıtları.
 *
 * Kayıt açılınca ekipman "Serviste" oluyor, sonuç girilince kullanıma dönüyor.
 * Ücret sahip olma maliyetine giriyor; garanti kapsamındaki iş girmiyor.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import { bolumAc } from "./ortak.mjs";

const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/servis";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const damga = Date.now().toString().slice(-6);

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});

try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', process.env.E2E_USER ?? "enginc");
  await page.fill('input[name="password"]', process.env.E2E_PASSWORD ?? "cok-uzun-sifre");
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // 10.000,00 ₺'lik bir ekipman: maliyet toplamını izleyeceğiz.
  const AD = "Bulaşık makinesi " + damga;
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', AD);
  await page.fill('input[name="purchasePrice"]', "10.000");
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${AD}`, { timeout: 15000 });
  await page.locator(`a:has-text("${AD}")`).first().tap();
  // Başlığı büyük harfle aramıyoruz: Türkçe "İ" küçültülünce eşleşmiyor.
  await bolumAc(page, "Servis");
  log("ekipman açıldı");

  // 1) Servise gönder → durum "Serviste"
  await page.tap('button:has-text("+ Servise gönder")');
  await page.waitForSelector('div[role="dialog"][aria-label="Servise gönder"]');
  await page.fill('textarea[name="complaint"]', "Su almıyor, tamburdan ses geliyor");
  // Lokasyonun firması varsa alan açılır liste geliyor; "yeni" ile ad kutusuna
  // geçiyoruz (satıcı alanındaki kuralın aynısı).
  const liste = page.locator('div[role="dialog"] select[name="vendorId"]');
  if (await liste.count()) await liste.selectOption("__yeni__");
  await page.fill('input[name="vendorName"]', "Bosch Yetkili Servisi " + damga);
  await page.fill('input[name="trackingNo"]', "FIS-" + damga);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 20000 });
  await page.waitForSelector("text=Bugün gönderildi", { timeout: 15000 });
  const durum = await page.locator("body").innerText();
  if (!durum.includes("Serviste")) throw new Error("ekipman servise alınmadı");
  log("servise gönderildi, durum Serviste oldu");
  await page.screenshot({ path: `${out}/1-serviste.png` });

  // 2) Sonucu gir → durum kullanıma döner, ücret maliyete girer
  await page.tap('button:has-text("Sonucu gir")');
  await page.waitForSelector('div[role="dialog"][aria-label="Servis sonucu"]');
  await page.fill('textarea[name="work"]', "Pompa değişti, filtre temizlendi");
  await page.fill('input[name="cost"]', "1.250");
  await page.locator('div[role="dialog"] input[name="paid"]').check();
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 20000 });
  await page.waitForSelector("text=Pompa değişti", { timeout: 15000 });

  const sonra = await page.locator("body").innerText();
  if (!sonra.includes("Ödendi")) throw new Error("ödeme durumu yazılmadı");
  if (!sonra.includes("1.250,00 ₺")) throw new Error("servis ücreti görünmüyor");
  if (!sonra.includes("11.250,00 ₺")) {
    throw new Error("sahip olma maliyetine servis ücreti girmedi");
  }
  if (sonra.includes("Serviste")) throw new Error("ekipman kullanıma dönmedi");
  log("sonuç girildi: kullanıma döndü, ücret maliyete girdi");
  await page.screenshot({ path: `${out}/2-sonuc.png` });

  // 3) Garanti kapsamındaki iş maliyete girmemeli
  await page.tap('button:has-text("+ Servise gönder")');
  await page.waitForSelector('div[role="dialog"][aria-label="Servise gönder"]');
  await page.fill('textarea[name="complaint"]', "Kapak kilidi tutmuyor");
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 20000 });
  await page.tap('button:has-text("Sonucu gir")');
  await page.waitForSelector('div[role="dialog"][aria-label="Servis sonucu"]');
  await page.fill('textarea[name="work"]', "Kilit garanti kapsamında değişti");
  await page.locator('div[role="dialog"] input[name="underWarranty"]').check();
  // Garanti işaretlenince ücret alanı hiç sorulmuyor.
  if (await page.locator('div[role="dialog"] input[name="cost"]').count()) {
    throw new Error("garanti kapsamındayken ücret soruluyor");
  }
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 20000 });
  await page.waitForSelector("text=Garanti kapsamında", { timeout: 15000 });

  const garanti = await page.locator("body").innerText();
  if (!garanti.includes("11.250,00 ₺")) {
    throw new Error("garanti kapsamındaki iş maliyeti değiştirdi");
  }
  log("garanti kapsamındaki iş maliyete girmedi");
  await page.screenshot({ path: `${out}/3-garanti.png` });

  // 4) Görüntüleyen servis kaydı açamaz
  const yabanciCtx = await browser.newContext(iphone);
  const yabanci = await yabanciCtx.newPage();
  await yabanci.goto(`${BASE}/giris`);
  await yabanci.fill('input[name="username"]', "aysek");
  await yabanci.fill('input[name="password"]', process.env.E2E_PASSWORD ?? "cok-uzun-sifre");
  await yabanci.tap('button[type="submit"]');
  await yabanci.waitForURL("**/lokasyonlar");
  const itemId = page.url().split("/").pop();
  const status = await yabanci.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/servis`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ complaint: "deneme" }),
    });
    return r.status;
  }, itemId);
  if (status === 201) throw new Error("üye olmayan servis kaydı açabildi");
  log("üye olmayan servis kaydı açamıyor:", status);

  console.log("\nSERVİS TESTİ GEÇTİ");
} finally {
  await browser.close();
}
