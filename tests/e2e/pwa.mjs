import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/pwa"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const context = await browser.newContext(iphone);
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // Manifest ve ikonlar
  const manifest = await page.evaluate(async () => {
    const r = await fetch("/manifest.webmanifest");
    return { durum: r.status, govde: await r.json() };
  });
  if (manifest.durum !== 200) throw new Error("manifest yok");
  if (manifest.govde.display !== "standalone") throw new Error("display standalone değil");
  log("manifest:", manifest.govde.short_name, "·", manifest.govde.display, "·", manifest.govde.icons.length, "ikon");

  // Yumuşak geçişte Next başlık etiketlerini yeniden basabiliyor; kısa bir an
  // iki tane olabiliyor. Aranan şey "bir tane var mı", "kaç tane" değil.
  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .first()
    .getAttribute("href");
  const iconStatus = await page.evaluate(async (u) => (await fetch(u)).status, appleIcon);
  if (iconStatus !== 200) throw new Error("apple-touch-icon sunulmuyor");
  log("apple-touch-icon:", appleIcon, iconStatus);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  if (!viewport.includes("viewport-fit=cover")) throw new Error("viewport-fit=cover yok");
  if (viewport.includes("maximum-scale")) throw new Error("maximum-scale konmuş (TUZAKLAR #8)");
  log("viewport:", viewport);

  // Fotoğraflı ekipman
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const ad = "Zoom testi " + Date.now();
  await page.fill('input[name="name"]', ad);
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad}`);
  await page.locator(`a:has-text("${ad}")`).first().tap();
  await page.waitForSelector("text=FOTOĞRAF VE BELGELER");
  const itemUrl = page.url();
  await page.selectOption('select[aria-label="Belge türü"]', "PHOTO");
  await page.setInputFiles('input[type="file"]', "/tmp/testfiles/foto.png");
  await page.waitForSelector("figure img", { timeout: 20000 });

  // Görüntüleyiciyi aç
  await page.locator('button[aria-label$="büyüt"]').first().tap();
  await page.waitForSelector('[data-testid="zoom-gorsel"]');
  log("görüntüleyici açıldı");
  await page.screenshot({ path: `${out}/1-goruntuleyici.png` });

  const olcek = async () => {
    const t = await page.locator('[data-testid="zoom-gorsel"]').evaluate((el) => getComputedStyle(el).transform);
    if (t === "none") return 1;
    return Number(t.match(/matrix\(([-\d.]+)/)[1]);
  };
  if ((await olcek()) !== 1) throw new Error("başlangıç ölçeği 1 değil");

  // İki parmakla büyütme — CDP ile gerçek dokunma olayları (TUZAKLAR #23:
  // koordinatlar ekran içinde kalmalı)
  const cdp = await context.newCDPSession(page);
  const touch = async (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });

  await touch("touchStart", [
    { x: 160, y: 420, id: 1 },
    { x: 230, y: 420, id: 2 },
  ]);
  for (const yayilma of [30, 60, 90, 120]) {
    await touch("touchMove", [
      { x: 160 - yayilma, y: 420, id: 1 },
      { x: 230 + yayilma, y: 420, id: 2 },
    ]);
    await page.waitForTimeout(60);
  }
  await touch("touchEnd", []);
  await page.waitForTimeout(200);

  const buyuk = await olcek();
  if (buyuk <= 1.2) throw new Error(`büyütme çalışmadı, ölçek ${buyuk}`);
  log("iki parmakla büyütüldü, ölçek:", buyuk.toFixed(2));
  await page.screenshot({ path: `${out}/2-buyutulmus.png` });

  // Kaydırma: yakınlaştırılmışken tek parmak gezdiriyor
  await touch("touchStart", [{ x: 195, y: 420, id: 1 }]);
  await touch("touchMove", [{ x: 260, y: 420, id: 1 }]);
  await touch("touchEnd", []);
  await page.waitForTimeout(150);
  const kaydirma = await page.locator('[data-testid="zoom-gorsel"]').evaluate((el) => {
    const m = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
    return Number(m[1].split(",")[4]);
  });
  if (Math.abs(kaydirma) < 1) throw new Error("kaydırma çalışmadı");
  log("yakınlaştırılmışken kaydırma çalışıyor, x:", kaydirma.toFixed(0));

  // Çift dokunuş küçültür
  await touch("touchStart", [{ x: 195, y: 420, id: 1 }]);
  await touch("touchEnd", []);
  await page.waitForTimeout(80);
  await touch("touchStart", [{ x: 195, y: 420, id: 1 }]);
  await touch("touchEnd", []);
  await page.waitForTimeout(300);
  const sonra = await olcek();
  if (sonra > 1.01) throw new Error(`çift dokunuş küçültmedi: ${sonra}`);
  log("çift dokunuş başa döndürdü");

  // Geri tuşu görüntüleyiciyi kapatır, sayfadan atmaz (TUZAKLAR #17)
  await page.goBack();
  await page.waitForSelector('[data-testid="zoom-gorsel"]', { state: "detached", timeout: 5000 });
  if (page.url() !== itemUrl) throw new Error(`geri tuşu sayfadan attı: ${page.url()}`);
  log("geri tuşu görüntüleyiciyi kapattı, sayfa yerinde");

  console.log("\nPWA VE BÜYÜTME TESTİ GEÇTİ");
} finally {
  await browser.close();
}
