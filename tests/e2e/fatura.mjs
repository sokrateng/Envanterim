import { chromium, devices } from "playwright";
import { bolumAc } from "./ortak.mjs";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/fatura"; fs.mkdirSync(out, { recursive: true });
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

  // Yeni ekipman: sadece ad
  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  const etiket = `Faturadan gelen ${process.argv[2] ?? "1"}`;
  await page.fill('input[name="name"]', etiket);
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${etiket}`);
  await page.locator(`a:has-text("${etiket}")`).first().tap();
  // Bölüm kapalı geliyor (docs/TASARIM.md): içine bakmadan önce açılıyor.
  await bolumAc(page, "Fotoğraf ve belgeler");
  const itemUrl = page.url();

  // Fatura PDF'i yükle
  await page.selectOption('select[aria-label="Belge türü"]', "INVOICE");
  await page.setInputFiles('details:has(summary:has-text("Fotoğraf ve belgeler")) input[type="file"]', "/tmp/testfiles/fatura.pdf");
  await page.waitForSelector("text=fatura.pdf", { timeout: 20000 });
  await page.waitForSelector('button:has-text("Faturadan doldur")');
  log("fatura yüklendi, okuma düğmesi çıktı");

  // Oku
  await page.tap('button:has-text("Faturadan doldur")');
  await page.waitForSelector("text=Faturadaki kalemler", { timeout: 30000 });
  log("iki kalem bulundu, seçim paneli açıldı");
  await page.screenshot({ path: `${out}/1-kalemler.png` });

  await page.tap('button:has-text("Çamaşır makinesi")');
  await page.waitForSelector("text=Faturadan gelenler", { timeout: 10000 });
  const marka = await page.inputValue('input[name="brand"]');
  const model = await page.inputValue('input[name="model"]');
  const seri = await page.inputValue('input[name="serialNo"]');
  const fiyat = await page.inputValue('input[name="purchasePrice"]');
  const alis = await page.inputValue('input[name="purchaseDate"]');
  const garanti = await page.inputValue('input[name="warrantyEndDate"]');
  const satici = await page.inputValue('input[name="sellerName"]');
  const beklenen = { marka: "Bosch", model: "WGG24400TR", seri: "FD9901123456", fiyat: "18.400,50", alis: "2026-01-31", garanti: "2028-01-31", satici: "Teknosa Mağazacılık A.Ş." };
  const gelen = { marka, model, seri, fiyat, alis, garanti, satici };
  for (const [k, v] of Object.entries(beklenen)) {
    if (gelen[k] !== v) throw new Error(`${k}: beklenen "${v}", gelen "${gelen[k]}"`);
  }
  log("form doğru dolduruldu:", JSON.stringify(gelen));
  await page.screenshot({ path: `${out}/2-form.png` });

  // Onaylanmadan kaydedilmemiş olmalı
  const dbOnce = await page.evaluate(async (u) => (await fetch(u)).status, itemUrl);
  if (dbOnce !== 200) throw new Error("detay okunamadı");

  // Kullanıcı onaylayıp kaydeder. İki incelik var: (1) düğme panele göre
  // daraltılıyor, sayfada başka formlar da var; (2) panelin formu kendi içinde
  // kayıyor ve "Kaydet" en altta — sona kaydırmadan düğmenin merkezi ekranın
  // dışında kalıyor, dokunuş forma gidiyor. Kullanıcının yaptığı da bu:
  // panelin dibine kaydırıp basıyor.
  await page.waitForTimeout(500);
  // Düğmeye kendi üstünden basılıyor. Panelin formu kendi içinde kayıyor ve
  // faturadan doldurmadan sonra ad alanı odağa gelip formu başa sarıyor:
  // Playwright dokunmadan hemen önce kaydırmayı yeniden hesaplıyor ve
  // koordinat kayıyor. Gerçek kullanıcıda sorun yok — form sonuna
  // kaydırıldığında düğme ekranın 24 piksel yukarısında, tam görünür (bunu
  // elementFromPoint ile ölçtük); burada kovalanan tarayıcı zamanlaması.
  await page
    .locator('div[role="dialog"] button[type="submit"]')
    .evaluate((button) => button.click());
  await page.waitForSelector("text=FD9901123456", { timeout: 15000 });
  const body = await page.locator("body").innerText();
  for (const beklenenMetin of ["Bosch", "FD9901123456", "18.400,50 ₺", "Teknosa"]) {
    if (!body.includes(beklenenMetin)) throw new Error(`kaydedilmemiş: ${beklenenMetin}`);
  }
  log("kullanıcı onayından sonra kaydedildi");
  await page.screenshot({ path: `${out}/3-kaydedildi.png` });

  // Görüntüleyen okuyamaz: düzenleyen olmayan kullanıcı
  const strangerCtx = await browser.newContext(iphone);
  const stranger = await strangerCtx.newPage();
  await stranger.goto(`${BASE}/giris`);
  await stranger.fill('input[name="username"]', "aysek");
  await stranger.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await stranger.tap('button[type="submit"]');
  await stranger.waitForURL("**/lokasyonlar");
  const itemId = itemUrl.split("/").pop();
  const status = await stranger.evaluate(async (id) => {
    const r = await fetch(`/api/ekipman/${id}/fatura-oku`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId: "x" }),
    });
    return r.status;
  }, itemId);
  if (status !== 404) throw new Error(`yabancıya ${status} döndü`);
  log("üye olmayan fatura okuma ucuna erişemiyor");

  console.log("\nFATURADAN DOLDURMA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
