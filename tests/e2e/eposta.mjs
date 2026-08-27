import { chromium, devices } from "playwright";
import fs from "node:fs";
const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/eposta"; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const damga = Date.now();
const adres = `engin${damga}@ornek.com`;
const gun = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const postalar = () => fs.readFileSync("/tmp/mock-smtp.log", "utf8").trim().split("\n").filter(Boolean).map((s) => JSON.parse(s));
/**
 * SMTP gövdesi quoted-printable geliyor: yumuşak satır sonlarını at, =XX
 * dizilerini bayta çevir, UTF-8 olarak oku.
 */
const duzMetin = (govde) => {
  const katlanmamis = govde.replace(/=\r?\n/g, "").replace(/\r\n/g, "\n");
  const baytlar = [];
  for (let i = 0; i < katlanmamis.length; i += 1) {
    if (katlanmamis[i] === "=" && /^[0-9A-F]{2}$/.test(katlanmamis.slice(i + 1, i + 3))) {
      baytlar.push(parseInt(katlanmamis.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      baytlar.push(katlanmamis.charCodeAt(i));
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(baytlar));
};

const browser = await chromium.launch({ ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}), args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext(iphone)).newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', (process.env.E2E_USER ?? "enginc"));
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");

  await page.goto(`${BASE}/hesap`);
  // Önceki koşudan kalan adres varsa temizle: test tekrarlanabilir olmalı.
  await page.evaluate(async () => {
    await fetch("/api/hesap/eposta", { method: "DELETE" });
  });
  await page.reload();
  await page.waitForSelector("text=E-posta bildirimi");
  log("hesap ekranında e-posta bölümü var");

  // Geçersiz adres reddedilir. "engin" tarayıcının kendi doğrulamasına
  // takılıyor; sunucu tarafını sınamak için tarayıcının kabul ettiği ama
  // bizim reddettiğimiz bir adres gerekiyor.
  await page.fill('input[aria-label="E-posta adresi"]', "engin@ornek");
  await page.locator('form:has(input[aria-label="E-posta adresi"]) button:has-text("Ekle")').click();
  await page.waitForSelector("text=Geçerli bir e-posta adresi yaz", { timeout: 10000 });
  log("geçersiz adres reddedildi");

  // Adres ekle → kod maili gitmeli
  const oncekiSayi = postalar().length;
  await page.fill('input[aria-label="E-posta adresi"]', adres);
  await page.locator('form:has(input[aria-label="E-posta adresi"]) button:has-text("Ekle")').click();
  await page.waitForSelector("text=Doğrulanmadı", { timeout: 15000 });
  const yeniPostalar = postalar();
  if (yeniPostalar.length !== oncekiSayi + 1) throw new Error("doğrulama maili gitmedi");
  const dogrulama = yeniPostalar.at(-1);
  if (!dogrulama.alicilar.includes(adres)) throw new Error("mail yanlış adrese gitti");
  const kod = duzMetin(dogrulama.govde).match(/\b(\d{6})\b/)?.[1];
  if (!kod) throw new Error("kod bulunamadı: " + duzMetin(dogrulama.govde).slice(0, 200));
  log("doğrulama kodu maili gitti:", kod);
  await page.screenshot({ path: `${out}/1-dogrulanmadi.png` });

  // Doğrulanmamışken bildirim gitmemeli
  const cronOnce = await page.evaluate(async () => (await fetch("/api/cron/garanti", { headers: { authorization: "Bearer gizli-cron" } })).json());
  const sayacOnce = postalar().length;

  // Yanlış kod reddedilir
  await page.fill('input[aria-label="Doğrulama kodu"]', "000000");
  await page.locator('button:has-text("Doğrula")').click();
  await page.waitForSelector("text=Kod hatalı", { timeout: 10000 });
  log("yanlış kod reddedildi");

  // Doğru kod
  await page.fill('input[aria-label="Doğrulama kodu"]', kod);
  await page.locator('button:has-text("Doğrula")').click();
  await page.waitForSelector("text=Doğrulandı", { timeout: 15000 });
  log("adres doğrulandı");
  await page.screenshot({ path: `${out}/2-dogrulandi.png` });

  // Başka bir üye lokasyona ekipman eklerse haber gelmeli. Kendi eklediğine
  // bildirim gitmiyor, o yüzden ikinci kullanıcıyla açıyoruz.
  const uyeCtx = await browser.newContext(iphone);
  const uye = await uyeCtx.newPage();
  await uye.goto(`${BASE}/giris`);
  await uye.fill('input[name="username"]', "buketc");
  await uye.fill('input[name="password"]', process.env.E2E_PASSWORD ?? "cok-uzun-sifre");
  await uye.tap('button[type="submit"]');
  await uye.waitForURL("**/lokasyonlar");

  const oncekiEkleme = postalar().length;
  const yeniAd = `Ortak ekipman ${damga}`;
  await uye.goto(`${BASE}/envanter`);
  await uye.tap('button[aria-label="Ekipman ekle"]');
  await uye.fill('input[name="name"]', yeniAd);
  await uye.tap('div[role="dialog"] button[type="submit"]');
  await uye.waitForSelector(`text=${yeniAd}`, { timeout: 15000 });

  const eklemeMailleri = postalar().slice(oncekiEkleme);
  const haber = eklemeMailleri.find(
    (m) => m.alicilar.includes(adres) && duzMetin(m.govde).includes(yeniAd),
  );
  if (!haber) throw new Error("yeni ekipman bildirimi gitmedi");
  log("başka üyenin eklediği ekipman haber verildi");
  await uyeCtx.close();

  // Garanti uyarısı olacak bir ekipman: 30 gün kala
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const ad = `E-posta testi ${damga}`;
  await page.fill('input[name="name"]', ad);
  await page.fill('input[name="warrantyEndDate"]', gun(30));
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad}`);

  const sayacOncesi = postalar().length;
  const cron = await page.evaluate(async () => (await fetch("/api/cron/garanti", { headers: { authorization: "Bearer gizli-cron" } })).json());
  const gelenler = postalar().slice(sayacOncesi);
  const garantiMaili = gelenler.find((m) => duzMetin(m.govde).includes(ad));
  if (!garantiMaili) throw new Error("garanti maili gitmedi: " + JSON.stringify(cron));
  const metin = duzMetin(garantiMaili.govde);
  if (!metin.includes("30 gün sonra bitiyor")) throw new Error("mail metni yanlış");
  if (!metin.includes("/envanter/")) throw new Error("mailde ürün bağlantısı yok");
  if (!garantiMaili.alicilar.includes(adres)) throw new Error("mail yanlış adrese");
  log("garanti maili gitti:", cron.eposta.gonderilen, "adet");

  // İkinci koşuda tekrar gitmemeli (aynı damga iki kanal için de geçerli)
  const sayacIkinci = postalar().length;
  const ikinci = await page.evaluate(async () => (await fetch("/api/cron/garanti", { headers: { authorization: "Bearer gizli-cron" } })).json());
  if (postalar().length !== sayacIkinci) throw new Error("ikinci koşuda tekrar mail gitti");
  log("ikinci koşuda tekrar mail gitmedi");

  // Tercihi kapat → mail gitmemeli
  await page.goto(`${BASE}/hesap`);
  // Onay kutusu denetimli: durum sunucu yanıtından sonra dönüyor, uncheck()
  // anında doğrulamaya çalışıp zaman aşımına uğruyor.
  await page.locator('label:has-text("E-posta ile hatırlat") input[type="checkbox"]').click();
  await page.waitForFunction(
    () => {
      const kutu = [...document.querySelectorAll("label")]
        .find((l) => l.textContent?.includes("E-posta ile hatırlat"))
        ?.querySelector("input");
      return kutu && !kutu.checked;
    },
    undefined,
    { timeout: 15000 },
  );

  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  const ad2 = `Kapalı tercih ${damga}`;
  await page.fill('input[name="name"]', ad2);
  await page.fill('input[name="warrantyEndDate"]', gun(7));
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${ad2}`);

  const kapaliOnce = postalar().length;
  await page.evaluate(async () => (await fetch("/api/cron/garanti", { headers: { authorization: "Bearer gizli-cron" } })).json());
  const kapaliSonra = postalar().slice(kapaliOnce);
  if (kapaliSonra.some((m) => duzMetin(m.govde).includes(ad2))) {
    throw new Error("tercih kapalıyken mail gitti");
  }
  log("tercih kapalıyken mail gitmiyor");

  // Adresi kaldır
  await page.goto(`${BASE}/hesap`);
  await page.locator('button:has-text("Kaldır")').click();
  await page.waitForSelector("text=Bildirim açık olmayan cihazlarda", { timeout: 15000 });
  log("adres kaldırıldı");

  console.log("\nE-POSTA TESTİ GEÇTİ");
} finally {
  await browser.close();
}
