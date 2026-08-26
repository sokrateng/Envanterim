import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/push"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const log = (...a) => console.log("·", ...a);
const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  // 1) iPhone profili: tarayıcı sekmesinde bildirim yok, kullanıcıya yol gösterilmeli
  const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");
  await page.goto(`${BASE}/hesap`);
  await page.waitForSelector("text=Garanti bildirimi");
  await page.waitForSelector("text=Ana Ekrana Ekle");
  log("iPhone sekmesinde doğru yönlendirme gösteriliyor");
  await page.screenshot({ path: `${out}/1-hesap-iphone.png` });

  // 2) Service worker dosyası sunuluyor mu
  const sw = await page.evaluate(async () => {
    const r = await fetch("/sw.js");
    return { durum: r.status, tur: r.headers.get("content-type"), uzunluk: (await r.text()).length };
  });
  if (sw.durum !== 200) throw new Error("sw.js sunulmuyor");
  log("sw.js sunuluyor:", sw.uzunluk, "bayt");

  // 3) Abonelik ucu: kimliksiz istek reddedilmeli
  const anonim = await browser.newContext();
  const anonPage = await anonim.newPage();
  await anonPage.goto(`${BASE}/giris`);
  const durum = await anonPage.evaluate(async () => {
    const r = await fetch(`/api/push/abonelik`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "https://ornek/1", keys: { p256dh: "a", auth: "b" } }),
    });
    return r.status;
  });
  if (durum !== 401) throw new Error(`kimliksiz aboneliğe ${durum} döndü`);
  log("kimliksiz abonelik reddedildi (401)");

  console.log("\nBİLDİRİM ARAYÜZÜ TESTİ GEÇTİ");
} finally {
  await browser.close();
}
