import { chromium, devices } from "playwright";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const ad = "Fatura fotoğrafı " + Date.now();
  await page.fill('input[name="name"]', ad);
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad}`);
  await page.locator(`a:has-text("${ad}")`).first().tap();
  await page.waitForSelector("text=FOTOĞRAF VE BELGELER");
  await page.selectOption('select[aria-label="Belge türü"]', "INVOICE");
  await page.setInputFiles('input[type="file"]', "/tmp/testfiles/foto.png");
  await page.waitForSelector("figure img", { timeout: 20000 });
  await page.locator('figure button:has-text("Faturadan doldur")').first().tap();
  await page.waitForSelector("text=Faturadaki kalemler", { timeout: 30000 });
  console.log("· fatura fotoğrafından okuma çalıştı");
} finally {
  await browser.close();
}
