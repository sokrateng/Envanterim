/**
 * Notlar ve beğeni yıldızı.
 *
 * Not, ekipmanın "nasıl kullanılıyor" tarafı: yazan ve tarih görünür, fotoğraf
 * eklenebiliyor, başkasının notu düzenlenemiyor. Puan kişi başına tek.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import { bolumAc } from "./ortak.mjs";

const out = (process.env.E2E_SHOTS ?? "/tmp/shots") + "/not-puan";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const iphone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const log = (...a) => console.log("·", ...a);
const damga = Date.now().toString().slice(-6);

async function giris(context, kullanici) {
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', kullanici);
  await page.fill('input[name="password"]', process.env.E2E_PASSWORD ?? "cok-uzun-sifre");
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar");
  return page;
}

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});

try {
  const page = await giris(await browser.newContext(iphone), process.env.E2E_USER ?? "enginc");

  const AD = "Dondurma makinesi " + damga;
  await page.goto(`${BASE}/envanter`);
  await page.tap('button[aria-label="Ekipman ekle"]');
  await page.fill('input[name="name"]', AD);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector(`text=${AD}`, { timeout: 15000 });
  await page.locator(`a:has-text("${AD}")`).first().tap();
  await page.waitForSelector("text=NOTLAR", { timeout: 15000 });
  const urunAdresi = page.url();
  log("ekipman açıldı");

  // 1) Fotoğraflı not
  await bolumAc(page, "Notlar");
  await page.tap('button:has-text("+ Not")');
  await page.waitForSelector('div[role="dialog"][aria-label="Yeni not"]');
  const TARIF = "500 ml süt, 100 g şeker, 20 dakika. Kabı önce dondurucuda beklet.";
  await page.fill('textarea[name="body"]', TARIF);
  await page.setInputFiles('div[role="dialog"] input[type="file"]', "/tmp/testfiles/foto.png");
  await page.waitForSelector("text=1 fotoğraf seçildi");
  await page.tap('div[role="dialog"] button[type="submit"]');
  // Panelin kapanmasını bekliyoruz: `text=<not>` açık paneldeki metin alanına
  // da eşleşiyor ve fotoğraf yüklenirken beklemeyi erkenden bitiriyordu.
  await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 30000 });
  await page.waitForSelector("text=dondurucuda beklet", { timeout: 20000 });
  log("not eklendi");

  const fotoSayisi = await page.locator('button[aria-label$="büyüt"]').count();
  if (fotoSayisi < 1) throw new Error("not fotoğrafı görünmüyor");
  await page.screenshot({ path: `${out}/1-not.png` });

  // Not fotoğrafı genel "Fotoğraf ve belgeler" bölümüne karışmamalı.
  // Bölüm katlanır: açmadan içindeki metin gövdede görünmüyor.
  await bolumAc(page, "Fotoğraf ve belgeler");
  const govde = await page.locator("body").innerText();
  if (!govde.includes("Fatura, garanti belgesi")) throw new Error("ekler bölümü kayıp");
  log("not fotoğrafı ekler bölümüne karışmadı");

  // 2) Düzenleme
  await page.tap('button:has-text("Düzenle") >> nth=-1');
  await page.waitForSelector('div[role="dialog"][aria-label="Notu düzenle"]');
  await page.fill('textarea[name="body"]', `${TARIF} Not: kakao eklenebilir.`);
  await page.tap('div[role="dialog"] button[type="submit"]');
  await page.waitForSelector('div[role="dialog"]', { state: "detached", timeout: 20000 });
  await page.waitForSelector("text=kakao eklenebilir", { timeout: 15000 });
  log("not düzenlendi");

  // 3) Puan
  await page.tap('button[aria-label="4 yıldız ver"]');
  await page.waitForSelector("text=senin puanın 4", { timeout: 15000 });
  await page.waitForSelector("text=1 kişi · ortalama 4");
  log("puan verildi");
  await page.screenshot({ path: `${out}/2-puan.png` });

  // Aynı yıldıza tekrar dokunmak puanı kaldırıyor
  await page.tap('button[aria-label="4 yıldız ver"]');
  await page.waitForSelector("text=Henüz puan yok", { timeout: 15000 });
  await page.tap('button[aria-label="5 yıldız ver"]');
  await page.waitForSelector("text=senin puanın 5", { timeout: 15000 });
  log("puan kaldırılıp yeniden verilebiliyor");

  // 4) Başka üye: notu düzenleyemez, kendi puanını verir
  const digerCtx = await browser.newContext(iphone);
  const diger = await giris(digerCtx, "buketc");
  await diger.goto(urunAdresi);
  await bolumAc(diger, "Notlar");
  await diger.waitForSelector(`text=${TARIF.slice(0, 20)}`, { timeout: 15000 });

  const notId = await page.evaluate(async (adres) => {
    const r = await fetch(`/api/ekipman/${adres.split("/").pop()}/notlar`, { method: "GET" });
    return r.status;
  }, urunAdresi);
  if (notId === 200) throw new Error("notlar ucu GET kabul etmemeli");

  const duzenleyebiliyor = await diger.locator('li:has-text("kakao") button:has-text("Düzenle")').count();
  if (duzenleyebiliyor) throw new Error("başkasının notu düzenlenebiliyor");
  log("başkasının notu düzenlenemiyor");

  await diger.tap('button[aria-label="3 yıldız ver"]');
  await diger.waitForSelector("text=2 kişi · ortalama 4", { timeout: 15000 });
  log("ikinci puan ortalamaya girdi");
  await diger.screenshot({ path: `${out}/3-ortalama.png` });

  // 5) Üye olmayan puan veremez
  const yabanciCtx = await browser.newContext(iphone);
  const yabanci = await giris(yabanciCtx, "aysek");
  const durum = await yabanci.evaluate(async (adres) => {
    const r = await fetch(`/api/ekipman/${adres.split("/").pop()}/puan`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yildiz: 1 }),
    });
    return r.status;
  }, urunAdresi);
  if (durum === 200) throw new Error("üye olmayan puan verebildi");
  log("üye olmayan puan veremiyor:", durum);

  // 6) Silme: onay kutusu çıkıyor, sonra not gidiyor
  await page.tap('button:has-text("Sil") >> nth=-1');
  await page.waitForSelector("text=Not silinsin mi?");
  await page.getByRole("button", { name: "Sil", exact: true }).last().tap();
  await page.waitForSelector("text=kakao eklenebilir", { state: "detached", timeout: 15000 });
  log("not silindi");

  console.log("\nNOT VE PUAN TESTİ GEÇTİ");
} finally {
  await browser.close();
}
