import { chromium, devices } from "playwright";
import fs from "node:fs";

const out = process.argv[2] ?? "/tmp/shots";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// iPhone 14: 390x844, dokunmatik
const iphone = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};

const log = (...a) => console.log("·", ...a);
const URUN = "Çamaşır makinesi " + Date.now();
const SERI = "SN-" + Date.now();

async function login(context, username) {
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar", { timeout: 15000 });
  return page;
}

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});
try {
  // --- 1. Sahip: giriş, lokasyon, üye daveti, ekipman ---
  const ownerCtx = await browser.newContext(iphone);
  const page = await login(ownerCtx, (process.env.E2E_USER ?? "enginc"));
  log("giriş ok");
  await page.screenshot({ path: `${out}/1-lokasyonlar-bos.png` });

  await page.tap('button:has-text("+ Yeni")');
  await page.fill('input[name="name"]', "Ev");
  await page.fill('input[name="icon"]', "🏠");
  await page.screenshot({ path: `${out}/2-lokasyon-paneli.png` });
  await page.tap('button[type="submit"]');
  await page.waitForSelector('text=Ev', { timeout: 10000 });
  log("lokasyon oluşturuldu");
  await page.screenshot({ path: `${out}/3-lokasyonlar.png` });

  await page.tap('a:has-text("Ev")');
  await page.waitForSelector('text=Envanter');
  await page.tap('a:has-text("Üyeler")');
  await page.waitForSelector('h1:has-text("Üyeler")');
  await page.tap('button:has-text("+ Üye")');
  await page.fill('input[name="username"]', "buketc");
  await page.selectOption('select[name="role"]', "EDITOR");
  await page.tap('button[type="submit"]');
  await page.waitForSelector('text=@buketc', { timeout: 10000 });
  log("üye davet edildi");
  await page.screenshot({ path: `${out}/4-uyeler.png` });

  // Son sahibin rolü kilitli mi?
  const ownerSelect = page.locator('select[aria-label="Engin C rolü"]');
  if (!(await ownerSelect.isDisabled())) throw new Error("son sahip kilitli değil");
  log("son sahip korumalı");

  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', URUN);
  await page.fill('input[name="brand"]', "Bosch");
  await page.fill('input[name="model"]', "WGG24400TR");
  await page.fill('input[name="serialNo"]', SERI);
  await page.fill('input[name="purchasePrice"]', "18.400,50");
  const soon = new Date();
  soon.setDate(soon.getDate() + 12);
  await page.fill('input[name="warrantyEndDate"]', soon.toISOString().slice(0, 10));
  await page.screenshot({ path: `${out}/5-ekipman-formu.png` });
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${URUN}`, { timeout: 10000 });
  log("ekipman eklendi");

  // Rozeti listenin ilkinden değil, eklediğimiz satırdan oku: başka testler
  // sıralamayı değiştirebiliyor (TUZAKLAR #22'nin test tarafı).
  const badge = await page
    .locator(`a:has-text("${URUN}")`)
    .first()
    .locator('text=/\\d+ gün garanti/')
    .first()
    .innerText();
  if (badge !== "12 gün garanti") throw new Error(`garanti rozeti: ${badge}`);
  const price = await page
    .locator(`a:has-text("${URUN}")`)
    .first()
    .locator("text=18.400,50 ₺")
    .count();
  if (price !== 1) throw new Error("tutar biçimi yanlış");
  log("garanti rozeti ve tutar doğru:", badge);
  await page.screenshot({ path: `${out}/6-envanter.png` });

  // Arama ve durum filtresi
  await page.fill('input[type="search"]', SERI);
  await page.waitForTimeout(700);
  if (!(await page.locator(`text=${URUN}`).count())) throw new Error("seri no araması boş");
  await page.fill('input[type="search"]', "yok-böyle-bir-şey");
  await page.waitForTimeout(700);
  await page.waitForSelector("text=Bu filtreyle eşleşen ekipman bulunamadı");
  log("arama çalışıyor");
  await page.fill('input[type="search"]', "");
  await page.waitForTimeout(700);
  await page.tap('button[role="tab"]:has-text("Serviste")');
  await page.waitForURL(/durum=IN_REPAIR/);
  await page.waitForTimeout(600);
  // Kullanımdaki ekipman "Serviste" filtresinde görünmemeli. Listenin tümüyle
  // boş olmasını beklemiyoruz: veritabanında başka testlerin kayıtları var.
  if (await page.locator(`a:has-text("${URUN}")`).count()) {
    throw new Error("durum filtresi elemedi");
  }
  log("durum filtresi çalışıyor");
  await page.screenshot({ path: `${out}/7-filtre.png` });

  // Panel açıkken geri tuşu paneli kapatmalı, sayfadan atmamalı (TUZAKLAR #17)
  await page.tap('button[role="tab"]:has-text("Tümü")');
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.waitForSelector('role=dialog');
  await page.goBack();
  await page.waitForSelector('role=dialog', { state: "detached", timeout: 5000 });
  if (!page.url().includes("/envanter")) throw new Error(`geri tuşu sayfadan attı: ${page.url()}`);
  log("geri tuşu paneli kapattı, sayfa yerinde");

  // --- 2. EDITOR: görüyor, üye ekleyemiyor ---
  const editorCtx = await browser.newContext(iphone);
  const editor = await login(editorCtx, "buketc");
  await editor.goto(`${BASE}/envanter`);
  await editor.waitForSelector(`text=${URUN}`);
  await editor.goto(`${BASE}/lokasyonlar`);
  await editor.tap('a:has-text("Ev")');
  await editor.tap('a:has-text("Üyeler")');
  await editor.waitForSelector('h1:has-text("Üyeler")');
  if (await editor.locator('button:has-text("+ Üye")').count()) {
    throw new Error("düzenleyene üye ekleme düğmesi görünüyor");
  }
  log("düzenleyen: görüyor, üye ekleyemiyor");
  await editor.screenshot({ path: `${out}/8-duzenleyen-uyeler.png` });

  // --- 3. Yabancı: hiçbir şey görmüyor ---
  const strangerCtx = await browser.newContext(iphone);
  const stranger = await login(strangerCtx, "aysek");
  await stranger.goto(`${BASE}/envanter`);
  await stranger.waitForSelector("text=Önce bir lokasyon aç");
  const locationId = new URL(page.url()).searchParams.get("lokasyon");
  const res = await stranger.goto(`${BASE}/lokasyonlar/${locationId ?? "yok"}`);
  if (res && res.status() !== 404) throw new Error(`yabancıya ${res.status()} döndü`);
  log("yabancı: envanter boş, lokasyon 404");
  await stranger.screenshot({ path: `${out}/9-yabanci.png` });

  console.log("\nDUMAN TESTİ GEÇTİ");
} finally {
  await browser.close();
}
