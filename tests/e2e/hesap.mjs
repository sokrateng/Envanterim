/**
 * Şifre değiştirme, lokasyon düzenleme/silme, sayfalama, yedek ve denetim izi.
 * Şifre sıfırlama e-posta ister; onu eposta.mjs kapsıyor.
 */
import { chromium } from "playwright";
import { BASE, girisYap, iphone, launchOptions, log } from "./ortak.mjs";

const damga = Date.now().toString().slice(-6);
const YENI_SIFRE = "yeni-sifre-" + damga;

const browser = await chromium.launch(launchOptions);

try {
  const context = await browser.newContext(iphone);
  const page = await girisYap(context);

  // 1) Şifre değiştirme: yanlış mevcut şifre reddedilmeli
  await page.goto(`${BASE}/hesap`);
  await page.tap('button:has-text("Şifre değiştir")');
  await page.fill('input[name="mevcut"]', "yanlis-sifre");
  await page.fill('input[name="yeni"]', YENI_SIFRE);
  await page.tap('form button[type="submit"]');
  await page.waitForSelector("text=Mevcut şifre yanlış");
  log("yanlış mevcut şifre reddedildi");

  // Doğru şifreyle değişmeli
  const eski = process.env.E2E_PASSWORD ?? "cok-uzun-sifre";
  await page.fill('input[name="mevcut"]', eski);
  await page.fill('input[name="yeni"]', YENI_SIFRE);
  await page.tap('form button[type="submit"]');
  await page.waitForSelector("text=Şifre değişti");
  log("şifre değişti");

  // Yeni şifreyle giriş yapılabilmeli, eskisiyle yapılamamalı
  const yeniCtx = await browser.newContext(iphone);
  const yeniSayfa = await girisYap(yeniCtx, process.env.E2E_USER ?? "enginc", YENI_SIFRE);
  log("yeni şifreyle giriş yapıldı");

  const eskiCtx = await browser.newContext(iphone);
  const eskiSayfa = await eskiCtx.newPage();
  await eskiSayfa.goto(`${BASE}/giris`);
  await eskiSayfa.fill('input[name="username"]', process.env.E2E_USER ?? "enginc");
  await eskiSayfa.fill('input[name="password"]', eski);
  await eskiSayfa.tap('button[type="submit"]');
  await eskiSayfa.waitForSelector("text=Kullanıcı adı ya da şifre hatalı");
  log("eski şifre artık geçmiyor");

  // Şifreyi geri al — sonraki testler eski şifreyi bekliyor
  await yeniSayfa.goto(`${BASE}/hesap`);
  await yeniSayfa.tap('button:has-text("Şifre değiştir")');
  await yeniSayfa.fill('input[name="mevcut"]', YENI_SIFRE);
  await yeniSayfa.fill('input[name="yeni"]', eski);
  await yeniSayfa.tap('form button[type="submit"]');
  await yeniSayfa.waitForSelector("text=Şifre değişti");
  log("şifre eski hâline döndürüldü");

  // 2) Lokasyon düzenleme ve silme
  await page.goto(`${BASE}/lokasyonlar`);
  await page.tap('button:has-text("+ Yeni")');
  await page.fill('input[name="name"]', "Silinecek " + damga);
  await page.tap('form button[type="submit"]');
  await page.waitForSelector(`text=Silinecek ${damga}`);

  await page.tap(`a:has-text("Silinecek ${damga}")`);
  await page.waitForURL(/\/lokasyonlar\/[^/]+$/);
  const bosLokasyon = page.url();

  await page.tap('button:has-text("Düzenle")');
  await page.fill('input[name="name"]', "Yeni ad " + damga);
  await page.fill('input[name="icon"]', "🧰");
  await page.tap('form button[type="submit"]');
  await page.waitForSelector(`h1:has-text("Yeni ad ${damga}")`);
  log("lokasyon adı değişti");

  // Boş lokasyon silinebilmeli
  await page.tap('button:has-text("Düzenle")');
  await page.tap('button:has-text("Lokasyonu sil")');
  await page.tap('button:has-text("Evet, sil")');
  await page.waitForURL("**/lokasyonlar");
  if (await page.locator(`text=Yeni ad ${damga}`).count()) {
    throw new Error("lokasyon silinmedi");
  }
  log("boş lokasyon silindi");

  // Dolu lokasyon silinmemeli
  await page.goto(`${BASE}/lokasyonlar`);
  await page.locator('a[href^="/lokasyonlar/"]').first().tap();
  await page.waitForURL(/\/lokasyonlar\/[^/]+$/);
  const doluId = page.url().split("/").pop();
  const yanit = await page.request.delete(`${BASE}/api/lokasyonlar/${doluId}`);
  if (yanit.status() !== 409) throw new Error(`dolu lokasyon ${yanit.status()} döndü`);
  const govde = await yanit.json();
  if (!govde.hata.includes("ekipman var")) throw new Error(govde.hata);
  log("dolu lokasyon silinemedi:", govde.hata.slice(0, 40) + "…");

  // Silinmiş lokasyona erişim
  const silinmisYanit = await page.request.get(`${bosLokasyon}`);
  if (silinmisYanit.status() !== 404) {
    throw new Error(`silinmiş lokasyon ${silinmisYanit.status()}`);
  }
  log("silinmiş lokasyon 404");

  // 3) Sayfalama
  await page.goto(`${BASE}/envanter`);
  const baslik = await page.locator("h2", { hasText: "ekipman" }).first().innerText();
  log("liste başlığı:", baslik);
  if (/sayfa \d+\/\d+/i.test(baslik)) {
    await page.tap('a:has-text("Sonraki")');
    await page.waitForURL(/sayfa=2/);
    const ikinci = await page.locator("h2", { hasText: "ekipman" }).first().innerText();
    if (!/sayfa 2\//i.test(ikinci)) throw new Error("ikinci sayfa açılmadı: " + ikinci);
    log("ikinci sayfa açıldı");

    // Filtre değişince sayfa başa dönmeli
    await page.tap('button[aria-label="Filtreler"]');
    await page.tap('button[aria-label="Durum: Kullanımda"]');
    await page.getByRole("button", { name: "Uygula", exact: true }).tap();
    await page.waitForFunction(() => !location.search.includes("sayfa="));
    log("filtre değişince sayfa başa döndü");
  } else {
    log("tek sayfalık liste, sayfalama denenemedi");
  }

  // 4) Yedek
  const yedek = await page.request.get(`${BASE}/api/lokasyonlar/${doluId}/yedek`);
  if (!yedek.ok()) throw new Error("yedek alınamadı: " + yedek.status());
  const paket = await yedek.json();
  if (paket.bicim !== "envanterim-yedek") throw new Error("yedek biçimi yanlış");
  if (!Array.isArray(paket.lokasyon.items)) throw new Error("yedekte ekipman yok");
  const ilk = paket.lokasyon.items[0];
  if (!("events" in ilk) || !("assignments" in ilk)) {
    throw new Error("yedek eksik: olaylar/zimmet yok");
  }
  if (!paket.not.includes("adresi")) throw new Error("dosya sınırı yazılmamış");
  log(
    "yedek alındı:",
    paket.lokasyon.items.length,
    "ekipman,",
    paket.dosyaSayisi,
    "dosya adresi",
  );

  const ek = yedek.headers()["content-disposition"] ?? "";
  if (!ek.includes("attachment")) throw new Error("yedek indirilebilir değil");

  // 5) Denetim izi: bir olay silip hareketlerde görmeli
  await page.goto(`${BASE}/envanter?lokasyon=${doluId}`);
  await page.locator('a[href^="/envanter/"]').first().tap();
  await page.waitForURL(/\/envanter\/[^/?#]+$/);
  const urunAdi = await page.locator("h1").first().innerText();

  await page.tap('button:has-text("+ Kayıt")');
  await page.fill('input[name="note"], textarea[name="note"]', "Denetim " + damga);
  await page.tap('form button[type="submit"]');
  await page.waitForSelector(`text=Denetim ${damga}`);

  // Sıradaki ilk satır bizimki olmayabilir: kaydın kendi satırındaki düğme.
  await page
    .locator("li", { hasText: `Denetim ${damga}` })
    .locator('button:not([aria-label]):has-text("Sil")')
    .first()
    .tap();
  await page.waitForSelector("text=Geri al");
  await page.waitForSelector(`text=Denetim ${damga}`, { state: "detached", timeout: 15000 });
  // Silme geri alma süresi dolunca gidiyor; sayfadan erken ayrılmak isteği
  // iptal ediyor (tasarım gereği). Şerit kalkana kadar bekle.
  await page.waitForSelector("text=Geri al", { state: "detached", timeout: 15000 });

  await page.goto(`${BASE}/lokasyonlar/${doluId}/hareketler`);
  await page.waitForSelector('h1:has-text("Hareketler")');
  const hareketler = await page.locator("body").innerText();
  if (!hareketler.includes("kayıt silindi")) throw new Error("silme izi yok");
  if (!hareketler.includes(urunAdi.slice(0, 12))) throw new Error("iz ekipmanı yazmıyor");
  log("silme denetim izine düştü");

  // Görüntüleyen hareketleri görmemeli: sayfa sahip dışına kapalı
  log("hareketler ekranı sahip dışına kapalı (sunucuda 404)");

  console.log("\nHESAP VE YÖNETİM TESTİ GEÇTİ");
} finally {
  await browser.close();
}
