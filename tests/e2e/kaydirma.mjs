import { chromium, devices } from "playwright";
import fs from "node:fs";
import { bolumAc } from "./ortak.mjs";

const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/kaydirma";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};
const log = (...a) => console.log("·", ...a);
const damga = Date.now().toString().slice(-6);

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});

/** Gerçek dokunma: CDP ile parmak hareketi — mouse olayları jesti tetiklemiyor. */
async function swipeLeft(page, box, mesafe = 130) {
  const session = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width - 20;
  const nokta = (x) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: nokta(x0),
  });
  for (let step = 1; step <= 6; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: nokta(x0 - (mesafe * step) / 6),
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

/** Sağa kaydırma: soldaki kısayol paneli. */
async function swipeRight(page, box, mesafe = 130) {
  const session = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  const x0 = box.x + 20;
  const nokta = (x) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];

  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: nokta(x0) });
  for (let step = 1; step <= 6; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: nokta(x0 + (mesafe * step) / 6),
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

/** Dikey sürükleme — jest yönü doğru seçiyor mu. */
async function swipeVertical(page, box, mesafe = 200) {
  const session = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  const nokta = (y) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];

  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: nokta(y0) });
  for (let step = 1; step <= 6; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: nokta(y0 - (mesafe * step) / 6),
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

try {
  const context = await browser.newContext(iphone);
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  // Kendi ekipmanımız: durum değiştirmeyi burada deneyeceğiz.
  const AD = "Kaydırma " + damga;
  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.fill('input[name="name"]', AD);
  await page.tap('form button[type="submit"]');
  await page.waitForSelector(`text=${AD}`, { timeout: 15000 });

  await page.goto(`${BASE}/envanter?q=${encodeURIComponent(damga)}`);
  const satir = page.locator('a[href^="/envanter/"]').first();
  await satir.waitFor();
  const kutu = await satir.boundingBox();

  // 1) Parmak satırın üstünde dikey giderse jest devreye girmemeli: liste
  // kaymazsa uzun envanterde uygulama kullanılamaz hâle gelir.
  await page.goto(`${BASE}/envanter`);
  const uzunSatir = page.locator('a[href^="/envanter/"]').first();
  await uzunSatir.waitFor();
  const uzunKutu = await uzunSatir.boundingBox();
  await swipeVertical(page, uzunKutu, 220);
  await page.waitForTimeout(300);
  const kaydi = await page.evaluate(() => window.scrollY);
  if (kaydi <= 0) throw new Error("dikey kaydırma jest tarafından yutuldu");
  const yatayKaydi = await page.evaluate(() => {
    const el = document.querySelector('a[href^="/envanter/"]')?.closest("div[style]");
    return el ? getComputedStyle(el).transform : "none";
  });
  if (yatayKaydi.includes("matrix(1, 0, 0, 1, -")) {
    throw new Error("dikey harekette satır yana kaydı");
  }
  log("dikey kaydırma jestten etkilenmedi:", kaydi, "px");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.goto(`${BASE}/envanter?q=${encodeURIComponent(damga)}`);
  await satir.waitFor();

  // 2) Sola kaydırınca işlem düğmeleri çıkmalı
  await swipeLeft(page, kutu);
  await page.waitForTimeout(350);
  const acik = await page.evaluate(() => {
    const el = document.querySelector('a[href^="/envanter/"]')?.closest("div[style]");
    return el ? getComputedStyle(el).transform : null;
  });
  if (!acik || acik === "none" || acik.includes("matrix(1, 0, 0, 1, 0, 0)")) {
    throw new Error(`satır açılmadı: ${acik}`);
  }
  log("satır sola kaydı:", acik);
  await page.screenshot({ path: `${out}/1-acik.png` });

  const zimmetDugmesi = page.locator('button[aria-label^="Zimmet:"]').first();
  if (!(await zimmetDugmesi.count())) throw new Error("işlem düğmesi yok");
  log("işlem düğmeleri göründü");

  // 2b) Sağa kaydırınca soldan "Düzenle" çıkmalı ve panel açık gelmeli.
  await page.goto(`${BASE}/envanter?q=${encodeURIComponent(damga)}`);
  await satir.waitFor();
  await swipeRight(page, kutu);
  await page.waitForTimeout(350);
  const duzenle = page.locator('button[aria-label^="Düzenle:"]').first();
  if (!(await duzenle.count())) throw new Error("sağa kaydırmada düzenle düğmesi yok");
  await page.screenshot({ path: `${out}/1b-duzenle.png` });
  await duzenle.tap();
  await page.waitForSelector('div[role="dialog"][aria-label="Ekipmanı düzenle"]', { timeout: 15000 });
  // Bayrak adresten silinmiş olmalı: yenilemede panel tekrar açılmasın.
  if (page.url().includes("duzenle=1")) throw new Error("adresteki bayrak silinmedi");
  log("sağa kaydırma düzenleme panelini açtı");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/envanter?q=${encodeURIComponent(damga)}`);
  await satir.waitFor();
  await swipeLeft(page, kutu);
  await page.waitForTimeout(350);

  // 3) "Serviste" düğmesi gerçekten durumu değiştirmeli
  const serviste = page.locator('button[aria-label^="Serviste:"]').first();
  await serviste.tap();
  await page.waitForSelector("text=Serviste", { timeout: 15000 });
  log("kaydırmadan durum değişti: Serviste");
  await page.screenshot({ path: `${out}/2-serviste.png` });

  // 4) Zaman çizelgesinde kaydırarak silme + geri alma
  await page.goto(`${BASE}/envanter?q=${encodeURIComponent(damga)}`);
  await page.locator('a[href^="/envanter/"]').first().tap();
  await page.waitForURL(/\/envanter\/[^/?#]+$/);
  await bolumAc(page, "Zaman çizelgesi");
  await page.tap('button:has-text("+ Kayıt")');
  await page.fill('textarea[name="note"], input[name="note"]', "Silinecek kayıt");
  await page.tap('form button[type="submit"]');
  await page.waitForSelector("text=Silinecek kayıt", { timeout: 15000 });

  const olay = page.locator("li", { hasText: "Silinecek kayıt" }).first();
  await olay.scrollIntoViewIfNeeded();
  const olayKutu = await olay.boundingBox();
  await swipeLeft(page, olayKutu, 100);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/3-olay-acik.png` });

  await page.locator('button[aria-label^="Sil:"]').first().tap();
  await page.waitForSelector("text=Geri al", { timeout: 5000 });
  log("silme geri alma şeridiyle bekliyor");
  await page.screenshot({ path: `${out}/4-geri-al.png` });

  await page.tap('button:has-text("Geri al")');
  await page.waitForSelector("text=Silinecek kayıt");
  log("geri alındı, kayıt duruyor");

  // Geri alınmadığında gerçekten silinmeli
  const olay2 = page.locator("li", { hasText: "Silinecek kayıt" }).first();
  await olay2.scrollIntoViewIfNeeded();
  await swipeLeft(page, await olay2.boundingBox(), 100);
  await page.waitForTimeout(300);
  await page.locator('button[aria-label^="Sil:"]').first().tap();
  await page.waitForSelector("text=Silinecek kayıt", { state: "detached", timeout: 15000 });
  log("süre dolunca silindi");

  console.log("\nKAYDIRMA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
