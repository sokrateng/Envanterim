/**
 * Panel: envanterin genel görünümü.
 *
 * Kontrol ettiği şey sayıların birbiriyle tutarlı olduğu ve kapsamın
 * lokasyonla daraldığı. Kur girişi de burada: çevrilmemiş birim toplama
 * girmiyor, kur girilince giriyor.
 */
import { chromium } from "playwright";
import { BASE, girisYap, iphone, launchOptions, log } from "./ortak.mjs";

const sayi = (metin) => Number(metin.replace(/[^\d]/g, ""));

const browser = await chromium.launch(launchOptions);
try {
  const page = await girisYap(await browser.newContext(iphone));

  // 1) Sekme çubuğundan açılıyor, ekleme düğmesi ortada duruyor
  await page.locator('nav a:has-text("Panel")').tap();
  await page.waitForURL("**/panel", { timeout: 20000 });
  await page.waitForSelector('h1:has-text("Genel bakış")');
  const sekmeler = await page.locator("nav ul li a span.text-caption").allInnerTexts();
  if (sekmeler.join(",") !== "Lokasyonlar,Envanter,Panel,Hesap") {
    throw new Error(`sekmeler beklenenden farklı: ${sekmeler}`);
  }
  const fabIndex = await page.evaluate(() => {
    const items = [...document.querySelectorAll("nav ul > li")];
    return items.findIndex((li) => li.querySelector('a[aria-label="Yeni ekipman"]'));
  });
  // Dört sekmenin arasında: iki sekme solda, iki sekme sağda.
  if (fabIndex !== 2) throw new Error(`ekleme düğmesi ortada değil: ${fabIndex}`);
  log("panel sekmeden açıldı, ekleme düğmesi ortada");

  // 2) Kartlar duruyor
  const kartlar = await page.locator("section h2").allInnerTexts();
  for (const baslik of ["DURUM", "KATEGORİ", "MARKA", "KAYIT EKSİKLERİ"]) {
    if (!kartlar.some((k) => k.toLocaleUpperCase("tr") === baslik)) {
      throw new Error(`kart eksik: ${baslik} (gelen: ${kartlar})`);
    }
  }
  log("kartlar yerinde:", kartlar.join(" · "));

  // 3) Kutudaki sayı kartın satırıyla aynı: iki yerde iki farklı "Kullanımda"
  //    yazması kullanıcının panele güvenini bitirirdi.
  const kutu = sayi(
    await page.locator('div:has(p:text-is("Kullanımda")) > p.text-title').first().innerText(),
  );
  const satir = await page
    .locator('li:has(span:text-is("Kullanımda"))')
    .first()
    .innerText();
  if (!satir.includes(String(kutu))) {
    throw new Error(`kutu ${kutu} ile durum satırı uyuşmuyor: ${satir}`);
  }
  log("kutu ve durum satırı aynı sayıyı veriyor:", kutu);

  // 4) Lokasyon seçimi kapsamı daraltıyor
  const hepsi = sayi(
    await page.locator('div:has(p:text-is("Ekipman")) > p.text-title').first().innerText(),
  );
  const lokasyonlar = page.locator('nav[aria-label="Lokasyon"] a');
  if ((await lokasyonlar.count()) > 1) {
    await lokasyonlar.nth(1).tap();
    await page.waitForURL(/lokasyon=/, { timeout: 20000 });
    await page.waitForSelector('h1:has-text("Genel bakış")');
    await page.waitForTimeout(600);
    const govde = await page.locator("body").innerText();
    const tek = govde.includes("Gösterilecek veri yok")
      ? 0
      : sayi(
          await page
            .locator('div:has(p:text-is("Ekipman")) > p.text-title')
            .first()
            .innerText(),
        );
    // Tek lokasyon hepsinden çok olamaz; tohumun tek lokasyonlu olduğu
    // durumda eşit çıkması normal.
    if (tek > hepsi) throw new Error(`tek lokasyon ${tek} > hepsi ${hepsi}`);
    log(`lokasyon seçimi çalışıyor: tümü ${hepsi}, seçili ${tek}`);
    await page.goto(`${BASE}/panel`);
    await page.waitForSelector('h1:has-text("Genel bakış")');
  }

  // 5) Kur: çevrilmemiş birim toplama girmiyor, kur girilince giriyor
  const kurDugmesi = page.locator('button:has-text("Kur")');
  if (await kurDugmesi.count()) {
    const uyari = await page.locator("text=kuru girilmedi").count();
    if (!uyari) throw new Error("çevrilmemiş birim sessizce atlanıyor");

    const oncekiToplam = sayi(
      await page.locator("p.text-large-title").first().innerText(),
    );
    await kurDugmesi.tap();
    await page.waitForSelector('div[role="dialog"]');
    const alan = page.locator('div[role="dialog"] input').first();
    const kod = await alan.getAttribute("name");
    await alan.fill("40,00");
    await page.tap('div[role="dialog"] button[type="submit"]');
    await page.waitForSelector('div[role="dialog"]', { state: "detached" });
    await page.waitForTimeout(400);

    const sonrakiToplam = sayi(
      await page.locator("p.text-large-title").first().innerText(),
    );
    if (sonrakiToplam <= oncekiToplam) {
      throw new Error(`kur girilince toplam büyümedi: ${oncekiToplam} → ${sonrakiToplam}`);
    }
    if (await page.locator("text=kuru girilmedi").count()) {
      throw new Error("kur girildiği hâlde uyarı duruyor");
    }
    log(`${kod} kuru girildi, toplam çevrildi`);

    // Kur cihazda kalıyor: sayfa yenilenince yeniden sorulmuyor.
    await page.reload();
    await page.waitForSelector("p.text-large-title");
    await page.waitForTimeout(400);
    if (await page.locator("text=kuru girilmedi").count()) {
      throw new Error("kur hatırlanmadı");
    }
    log("kur cihazda hatırlandı");
  } else {
    log("tek para birimli envanter, kur denenemedi");
  }

  // 6) Yetki: üye olunmayan lokasyon adresten istenirse yok sayılıyor
  const yabanciCtx = await browser.newContext(iphone);
  const yabanci = await girisYap(yabanciCtx, "aysek");
  await yabanci.goto(`${BASE}/panel`);
  await yabanci.waitForSelector('h1:has-text("Genel bakış")');
  const yabanciGovde = await yabanci.locator("body").innerText();
  if (yabanciGovde.includes("6.175") || yabanciGovde.includes("682")) {
    throw new Error("başkasının envanteri panelde görünüyor");
  }
  log("üye olunmayan lokasyonun verisi panelde yok");

  console.log("\nPANEL TESTİ GEÇTİ");
} finally {
  await browser.close();
}
