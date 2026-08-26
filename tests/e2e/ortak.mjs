/**
 * Uçtan uca testlerin ortak ayarları.
 *
 * Testler tarayıcıyı gerçekten açar ve iPhone 14 profilinde (390×844,
 * dokunmatik) koşar — masaüstünde fareyle bakmak bu uygulamada yetmiyor
 * (docs/TASARIM.md). Her şey ortam değişkeniyle değiştirilebilir ki başka bir
 * makinede de çalışsın.
 */
import { devices } from "playwright";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const KULLANICI = process.env.E2E_USER ?? "enginc";
export const SIFRE = process.env.E2E_PASSWORD ?? "cok-uzun-sifre";

/** Playwright'ın indirdiği tarayıcı yerine ortamdaki Chromium kullanılabilir. */
export const CHROMIUM = process.env.E2E_CHROMIUM ?? undefined;

export const iphone = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};

export const launchOptions = {
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ["--no-sandbox"],
};

export const log = (...parcalar) => console.log("·", ...parcalar);

/** Giriş yapmış bir sayfa döner. */
export async function girisYap(context, kullanici = KULLANICI, sifre = SIFRE) {
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', kullanici);
  await page.fill('input[name="password"]', sifre);
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");
  return page;
}
