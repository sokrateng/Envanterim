import { chromium, devices } from "playwright";
import fs from "node:fs";
import { bolumAc } from "./ortak.mjs";

const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/zimmet";
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
const EYLUL = "eylul" + damga;
const ANA = "iPhone 14 " + damga;
const ALT = "Claude aboneliği " + damga;
// Ad her koşuda ayrı: lokasyonda eski koşulardan kalma aynı adlı üyeler var.
const EYLUL_AD = "Eylül Çoban " + damga;

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});

async function giris(context, kullanici, sifre) {
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', kullanici);
  await page.fill('input[name="password"]', sifre);
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");
  return page;
}

async function ekipmanEkle(page, ad) {
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', ad);
  await page.tap('form button[type="submit"]');
  await page.waitForSelector(`text=${ad}`, { timeout: 15000 });
}

try {
  const sahipCtx = await browser.newContext(iphone);
  const sahip = await giris(sahipCtx, (process.env.E2E_USER ?? "enginc"), (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));

  // Aynı lokasyona hesabı olan bir üye: davet koduyla.
  await sahip.goto(`${BASE}/lokasyonlar`);
  await sahip.locator('a[href^="/lokasyonlar/"]').first().tap();
  await sahip.waitForURL(/\/lokasyonlar\/[^/]+$/);
  const lokasyonUrl = sahip.url();
  const lokasyonId = lokasyonUrl.split("/").pop();
  await sahip.tap('a:has-text("Üyeler")');
  await sahip.tap('button:has-text("+ Davet")');
  await sahip.selectOption('select[name="role"]', "EDITOR");
  await sahip.tap('button[type="submit"]');
  await sahip.waitForSelector("text=Tek kullanımlık, 7 gün geçerli.");
  const kod = (await sahip.locator("p.text-large-title").innerText()).trim();
  await sahip.tap('button:has-text("Bitti")');

  const eylulCtx = await browser.newContext(iphone);
  const eylul = await eylulCtx.newPage();
  await eylul.goto(`${BASE}/kayit?kod=${kod}`);
  await eylul.fill('input[name="name"]', EYLUL_AD);
  await eylul.fill('input[name="username"]', EYLUL);
  await eylul.fill('input[name="password"]', "yeterince-uzun");
  await eylul.tap('button[type="submit"]');
  await eylul.waitForURL("**/lokasyonlar", { timeout: 15000 });
  log("Eylül lokasyona üye oldu");

  // İki ekipman: ana ve alt
  await ekipmanEkle(sahip, ANA);
  await ekipmanEkle(sahip, ALT);
  await sahip.goto(`${BASE}/envanter?q=${encodeURIComponent(ANA)}`);
  await sahip.locator('a[href^="/envanter/"]').first().tap();
  await sahip.waitForURL(/\/envanter\/[^/?#]+$/);
  await sahip.waitForSelector(`h1:has-text("iPhone 14")`);
  const anaUrl = sahip.url();
  const anaId = anaUrl.split("/").pop();
  log("ana ekipman:", anaId);

  // 1) Alt ekipman bağlama
  await bolumAc(sahip, "Bileşenler");
  await sahip.tap('button:has-text("+ Bileşen")');
  await sahip.selectOption('select[name="childId"]', { label: ALT });
  await sahip.tap('form button[type="submit"]');
  await sahip.waitForSelector(`a:has-text("${ALT}")`, { timeout: 15000 });
  log("alt ekipman bağlandı");
  await sahip.screenshot({ path: `${out}/1-bilesen.png`, fullPage: true });

  // Alt ekipman sayfasında "Şunun parçası" görünmeli
  await sahip.tap(`a:has-text("${ALT}")`);
  // Gezinme bitmeden bölümü açmaya kalkarsak eski sayfanın başlığına
  // dokunuyoruz; yeni sayfa kapalı bölümle geliyor.
  await sahip.waitForSelector(`h1:has-text("${ALT}")`, { timeout: 15000 });
  await bolumAc(sahip, "Bileşenler");
  await sahip.waitForSelector("text=Şunun parçası");
  const altUrl = sahip.url();
  const altId = altUrl.split("/").pop();
  await sahip.goBack();

  // 2) Zimmet ver — hesabı olan üyeye
  await sahip.goto(anaUrl);
  await bolumAc(sahip, "Zimmet");
  await sahip.tap('button:has-text("+ Zimmet ver")');
  await sahip.selectOption('select[name="holderUserId"]', { label: EYLUL_AD });
  await sahip.fill('input[name="note"]', "Okul için");
  await sahip.tap('form button[type="submit"]');
  await sahip.waitForSelector("text=Teslim bekliyor", { timeout: 15000 });
  log("zimmet verildi, teslim bekliyor");
  await sahip.screenshot({ path: `${out}/2-bekliyor.png` });

  // Bileşen de birlikte gitti mi
  await sahip.goto(altUrl);
  await bolumAc(sahip, "Zimmet");
  await sahip.waitForSelector("text=Teslim bekliyor");
  log("bileşen de birlikte zimmetlendi");

  // 3) Sahip kendi ekranında "Teslim edildi" görüyor, Eylül "Üzerime al"
  await sahip.goto(anaUrl);
  await bolumAc(sahip, "Zimmet");
  const sahipMetni = await sahip.locator("#zimmet").innerText();
  if (!sahipMetni.includes("Teslim edildi")) {
    throw new Error(`sahip için beklenen düğme yok: ${sahipMetni}`);
  }

  await eylul.goto(anaUrl);
  await bolumAc(eylul, "Zimmet");
  await eylul
    .waitForSelector('button:has-text("Üzerime al")')
    .catch(async () => {
      console.log("EYLÜL ZIMMET:", await eylul.locator("#zimmet").innerText());
      throw new Error("Üzerime al yok");
    });
  log("Eylül'ün ekranında 'Üzerime al' var");
  await eylul.screenshot({ path: `${out}/3-eylul.png` });

  // 4) Rapor: bekleyen listesinde
  await sahip.goto(`${BASE}/lokasyonlar/${lokasyonId}/zimmet`);
  await sahip.waitForSelector('h1:has-text("Zimmet")');
  const raporMetni = await sahip.locator("body").innerText();
  if (!raporMetni.includes(ANA)) throw new Error("bekleyen raporda ekipman yok");
  log("bekleyen zimmet raporda");
  await sahip.screenshot({ path: `${out}/4-rapor.png`, fullPage: true });

  // 5) Eylül üzerine alıyor
  await eylul.goto(anaUrl);
  await bolumAc(eylul, "Zimmet");
  await eylul.tap('button:has-text("Üzerime al")');
  await eylul.waitForSelector("text=Üzerinde", { timeout: 15000 });
  log("Eylül ekipmanı üzerine aldı");
  await eylul.screenshot({ path: `${out}/5-uzerinde.png` });

  // Rapor artık bekleyenlerde değil, "kimde ne var"da
  await sahip.goto(`${BASE}/lokasyonlar/${lokasyonId}/zimmet`);
  const rapor2 = await sahip.locator("body").innerText();
  const bekleyenBolum = rapor2.split("KİMDE NE VAR")[0];
  if (bekleyenBolum.includes(ANA)) throw new Error("kabul edilen hâlâ bekliyor");
  if (!rapor2.includes(EYLUL_AD)) throw new Error("kimde ne var boş");
  log("kabul sonrası rapor doğru");

  // 6) Devir: Eylül'den hesapsız kişiye
  await sahip.goto(anaUrl);
  await bolumAc(sahip, "Zimmet");
  await sahip.tap('button:has-text("Devret")');
  await sahip.tap('button:has-text("Hesapsız kişi")');
  await sahip.fill('input[name="holderName"]', "Buket Çoban");
  await sahip.tap('form button[type="submit"]');
  await sahip.waitForSelector("text=Buket Çoban", { timeout: 15000 });
  log("hesapsız kişiye devredildi");
  await sahip.screenshot({ path: `${out}/6-devir.png` });

  // Eylül'ün üzerinden düştü mü
  await eylul.goto(anaUrl);
  await bolumAc(eylul, "Zimmet");
  const eylulMetni = await eylul.locator("#zimmet").innerText();
  if (eylulMetni.includes(EYLUL_AD)) throw new Error("devir sonrası eski sorumlu duruyor");

  // 7) Zaman çizelgesinde teslim izi
  const cizelge = await sahip.locator("body").innerText();
  if (!cizelge.includes("Devir ·")) throw new Error("devir zaman çizelgesinde yok");
  log("teslim izi zaman çizelgesinde");

  // 8) Hesapsız kişinin teslimini sahip işaretliyor
  await sahip.tap('button:has-text("Teslim edildi")');
  await sahip.waitForSelector("text=Üzerinde", { timeout: 15000 });
  log("hesapsız kişinin teslimi sahip adına işaretlendi");

  // 9) İade
  await sahip.tap('button:has-text("İade al")');
  await sahip.waitForSelector("text=Zimmetsiz", { timeout: 15000 });
  log("iade alındı, ekipman zimmetsiz");
  await sahip.screenshot({ path: `${out}/7-iade.png` });

  // 10) Yetki: girişsiz istek geçmez. Uygulamanın her yerinde olduğu gibi
  // "yok" ile "yetkisiz" aynı yanıtı alıyor; ekipmanın varlığı sızmıyor.
  const yabanciCtx = await browser.newContext(iphone);
  const yabanci = await yabanciCtx.newPage();
  const yanit = await yabanci.request.post(`${BASE}/api/ekipman/${anaId}/zimmet`, {
    data: { holderName: "Biri" },
  });
  if (yanit.ok()) throw new Error("girişsiz istek geçti");
  log("girişsiz zimmet isteği reddedildi:", yanit.status());

  // 11) Görüntüleyen zimmet veremez
  await sahip.goto(`${BASE}/lokasyonlar/${lokasyonId}/uyeler`);
  await sahip.tap('button:has-text("+ Davet")');
  await sahip.selectOption('select[name="role"]', "VIEWER");
  await sahip.tap('button[type="submit"]');
  await sahip.waitForSelector("text=Tek kullanımlık, 7 gün geçerli.");
  const kod2 = (await sahip.locator("p.text-large-title").innerText()).trim();

  const izleyiciCtx = await browser.newContext(iphone);
  const izleyici = await izleyiciCtx.newPage();
  await izleyici.goto(`${BASE}/kayit?kod=${kod2}`);
  await izleyici.fill('input[name="name"]', "İzleyen " + damga);
  await izleyici.fill('input[name="username"]', "izleyen" + damga);
  await izleyici.fill('input[name="password"]', "yeterince-uzun");
  await izleyici.tap('button[type="submit"]');
  await izleyici.waitForURL("**/lokasyonlar", { timeout: 15000 });

  const viewerYanit = await izleyici.request.post(`${BASE}/api/ekipman/${anaId}/zimmet`, {
    data: { holderName: "Biri" },
  });
  if (viewerYanit.status() !== 403) {
    throw new Error(`görüntüleyen ${viewerYanit.status()} aldı`);
  }
  log("görüntüleyen zimmet veremedi: 403");

  // Görüntüleyen ekranında da düğme yok
  await izleyici.goto(anaUrl);
  await izleyici.waitForSelector("h1");
  if (await izleyici.locator('button:has-text("Zimmet ver")').count()) {
    throw new Error("görüntüleyene zimmet düğmesi görünüyor");
  }
  log("görüntüleyenin ekranında zimmet düğmesi yok");

  console.log("\nZİMMET TESTİ GEÇTİ");
} finally {
  await browser.close();
}
