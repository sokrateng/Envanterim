import { chromium, devices } from "playwright";
import fs from "node:fs";

const out = process.argv[2] ?? (process.env.E2E_SHOTS ?? "/tmp/shots") + "/invite";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const KULLANICI = "eylul" + Date.now().toString().slice(-6);

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});
try {
  const ctx = await browser.newContext(iphone);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.tap('a:has-text("Ev")');
  await page.tap('a:has-text("Üyeler")');
  await page.waitForSelector('h1:has-text("Üyeler")');
  await page.tap('button:has-text("+ Davet")');
  await page.selectOption('select[name="role"]', "EDITOR");
  await page.tap('button[type="submit"]');
  await page.waitForSelector("text=Tek kullanımlık, 7 gün geçerli.");
  const code = (await page.locator("p.text-large-title").innerText()).trim();
  if (!/^[A-Z2-9]{10}$/.test(code)) throw new Error(`kod biçimi: ${code}`);
  log("davet kodu üretildi:", code);
  await page.screenshot({ path: `${out}/1-kod.png` });
  await page.tap('button:has-text("Bitti")');
  await page.waitForSelector(`text=${code}`);
  await page.screenshot({ path: `${out}/2-davet-listesi.png` });

  // Kodla kayıt
  const newCtx = await browser.newContext(iphone);
  const guest = await newCtx.newPage();
  await guest.goto(`${BASE}/kayit?kod=${code}`);
  await guest.screenshot({ path: `${out}/3-kayit.png` });
  await guest.fill('input[name="name"]', "Eylül C");
  await guest.fill('input[name="username"]', KULLANICI);
  await guest.fill('input[name="password"]', "yeterince-uzun");
  await guest.tap('button[type="submit"]');
  await guest.waitForURL("**/lokasyonlar", { timeout: 15000 });
  await guest.waitForSelector("text=Ev");
  log("kodla kayıt oldu ve lokasyona üye");
  await guest.screenshot({ path: `${out}/4-yeni-uye.png` });

  // EDITOR rolü geldi mi: ekipman ekleyebilmeli
  await guest.goto(`${BASE}/envanter`);
  if (!(await guest.locator('a[aria-label="Yeni ekipman"]').count())) {
    throw new Error("EDITOR rolü gelmemiş");
  }
  log("rol EDITOR olarak geldi");

  // Kod tekrar kullanılamaz
  const secondCtx = await browser.newContext(iphone);
  const second = await secondCtx.newPage();
  await second.goto(`${BASE}/kayit?kod=${code}`);
  await second.fill('input[name="name"]', "Deneme");
  await second.fill('input[name="username"]', KULLANICI + "a");
  await second.fill('input[name="password"]', "yeterince-uzun");
  await second.tap('button[type="submit"]');
  await second.waitForSelector("text=Bu davet kodu kullanılmış");
  log("kullanılmış kod reddedildi");

  // Geçersiz kod
  await second.goto(`${BASE}/kayit?kod=ZZZZZZZZZZ`);
  await second.fill('input[name="name"]', "Deneme");
  await second.fill('input[name="username"]', KULLANICI + "b");
  await second.fill('input[name="password"]', "yeterince-uzun");
  await second.tap('button[type="submit"]');
  await second.waitForSelector("text=Davet kodu geçersiz");
  log("geçersiz kod reddedildi");
  await second.screenshot({ path: `${out}/5-gecersiz-kod.png` });

  // Sahip olmayan davet üretemez
  const editorCtx = await browser.newContext(iphone);
  const editor = await editorCtx.newPage();
  await editor.goto(`${BASE}/giris`);
  await editor.fill('input[name="username"]', "buketc");
  await editor.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await editor.tap('button[type="submit"]');
  await editor.waitForURL("**/lokasyonlar");
  const locationId = new URL(page.url()).pathname.split("/")[2];
  const status = await editor.evaluate(async (id) => {
    const r = await fetch(`/api/lokasyonlar/${id}/davetler`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "OWNER" }),
    });
    return r.status;
  }, locationId);
  if (status !== 403) throw new Error(`düzenleyene davet ucu ${status} döndü`);
  log("düzenleyen davet üretemiyor (403)");

  console.log("\nDAVET AKIŞI GEÇTİ");
} finally {
  await browser.close();
}
