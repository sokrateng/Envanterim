import { chromium, devices } from "playwright";
import fs from "node:fs";

const out = process.argv[2] ?? "/tmp/shots";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// iPhone 14: 390x844, dokunmatik
const iphone = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};

const log = (...a) => console.log("·", ...a);
const URUN = "Çamaşır makinesi " + Date.now();
const SERI = "SN-" + Date.now();

async function login(context, username) {
  const page = await context.newPage();
  await page.goto(`${BASE}/giris`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', (process.env.E2E_PASSWORD ?? "cok-uzun-sifre"));
  await page.tap('button[type="submit"]');
  await page.waitForURL("**/lokasyonlar", { timeout: 15000 });
  return page;
}

const browser = await chromium.launch({
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  args: ["--no-sandbox"],
});
try {
  // --- 1. Sahip: giriş, lokasyon, üye daveti, ekipman ---
  const ownerCtx = await browser.newContext(iphone);
  const page = await login(ownerCtx, (process.env.E2E_USER ?? "enginc"));
  log("giriş ok");
  await page.screenshot({ path: `${out}/1-lokasyonlar-bos.png` });

  await page.tap('button:has-text("+ Yeni")');
  await page.fill('input[name="name"]', "Ev");
  await page.fill('input[name="icon"]', "🏠");
  await page.screenshot({ path: `${out}/2-lokasyon-paneli.png` });
  await page.tap('button[type="submit"]');
  await page.waitForSelector('text=Ev', { timeout: 10000 });
  log("lokasyon oluşturuldu");
  await page.screenshot({ path: `${out}/3-lokasyonlar.png` });

  await page.tap('a:has-text("Ev")');
  // `text=Envanter` sayfa başlığındaki <title>'a da eşleşiyor ve o hiç görünür
  // olmadığı için bekleme takılıyordu; görünür bir bağlantıyı bekliyoruz.
  await page.waitForSelector('a:has-text("Üyeler")');
  await page.tap('a:has-text("Üyeler")');
  await page.waitForSelector('h1:has-text("Üyeler")');
  await page.tap('button:has-text("+ Üye")');
  await page.fill('input[name="username"]', "buketc");
  await page.selectOption('select[name="role"]', "EDITOR");
  await page.tap('button[type="submit"]');
  await page.waitForSelector('text=@buketc', { timeout: 10000 });
  log("üye davet edildi");
  await page.screenshot({ path: `${out}/4-uyeler.png` });

  // Son sahibin rolü kilitli mi?
  const ownerSelect = page.locator('select[aria-label="Engin C rolü"]');
  if (!(await ownerSelect.isDisabled())) throw new Error("son sahip kilitli değil");
  log("son sahip korumalı");

  await page.goto(`${BASE}/envanter`);
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.fill('input[name="name"]', URUN);
  await page.fill('input[name="brand"]', "Bosch");
  await page.fill('input[name="model"]', "WGG24400TR");
  await page.fill('input[name="serialNo"]', SERI);
  await page.fill('input[name="purchasePrice"]', "18.400,50");
  const soon = new Date();
  soon.setDate(soon.getDate() + 12);
  await page.fill('input[name="warrantyEndDate"]', soon.toISOString().slice(0, 10));
  await page.screenshot({ path: `${out}/5-ekipman-formu.png` });
  await page.tap('button[type="submit"]');
  await page.waitForSelector(`text=${URUN}`, { timeout: 10000 });
  log("ekipman eklendi");

  // Etiketin taşıdığı adres; erişim denetimini bunun üstünden sınıyoruz.
  const itemId = (
    await page.locator(`a:has-text("${URUN}")`).first().getAttribute("href")
  ).split("/").pop();

  // Rozeti listenin ilkinden değil, eklediğimiz satırdan oku: başka testler
  // sıralamayı değiştirebiliyor (TUZAKLAR #22'nin test tarafı).
  const badge = await page
    .locator(`a:has-text("${URUN}")`)
    .first()
    .locator('text=/\\d+ gün garanti/')
    .first()
    .innerText();
  if (badge !== "12 gün garanti") throw new Error(`garanti rozeti: ${badge}`);
  // Tutar satırdan kalktı: sağdaki blokta durum ve garanti var (tasarım).
  const durum = await page
    .locator(`a:has-text("${URUN}")`)
    .first()
    .locator("text=Kullanımda")
    .count();
  if (durum !== 1) throw new Error("satırda durum yok");
  log("garanti rozeti ve durum doğru:", badge);
  await page.screenshot({ path: `${out}/6-envanter.png` });

  // Arama ve durum filtresi
  await page.fill('input[type="search"]', SERI);
  await page.waitForTimeout(700);
  if (!(await page.locator(`text=${URUN}`).count())) throw new Error("seri no araması boş");
  await page.fill('input[type="search"]', "yok-böyle-bir-şey");
  await page.waitForTimeout(700);
  await page.waitForSelector("text=Bu filtreyle eşleşen ekipman bulunamadı");
  log("arama çalışıyor");
  await page.fill('input[type="search"]', "");
  await page.waitForTimeout(700);
  // Filtreler tek düğmenin arkasında: aç, seç, uygula.
  await page.tap('button[aria-label="Filtreler"]');
  await page.tap('button[aria-label="Durum: Serviste"]');
  await page.getByRole("button", { name: "Uygula", exact: true }).tap();
  await page.waitForURL(/durum=IN_REPAIR/);
  await page.waitForTimeout(600);
  // Kullanımdaki ekipman "Serviste" filtresinde görünmemeli. Listenin tümüyle
  // boş olmasını beklemiyoruz: veritabanında başka testlerin kayıtları var.
  if (await page.locator(`a:has-text("${URUN}")`).count()) {
    throw new Error("durum filtresi elemedi");
  }
  log("durum filtresi çalışıyor");
  await page.screenshot({ path: `${out}/7-filtre.png` });

  // Çoklu seçim: "pasif hariç hepsi" demenin yolu kalanları işaretlemek.
  await page.tap('button[aria-label="Filtreler — 1 açık"]');
  await page.tap('button[aria-label="Durum: Kullanımda"]');
  await page.tap('button[aria-label="Durum: Satıldı"]');
  await page.getByRole("button", { name: "Uygula", exact: true }).tap();
  await page.waitForURL((url) => {
    const durum = url.searchParams.get("durum") ?? "";
    return (
      durum.includes("IN_REPAIR") &&
      durum.includes("IN_USE") &&
      durum.includes("SOLD") &&
      !durum.includes("RETIRED")
    );
  });
  await page.waitForTimeout(600);
  // Eklediğimiz kullanımdaki ekipman şimdi listede olmalı: seçime dahil.
  if (!(await page.locator(`a:has-text("${URUN}")`).count())) {
    throw new Error("çoklu seçimde kullanımdaki ekipman elendi");
  }
  // Pasif seçilmediği için listede pasif satır kalmamalı.
  if (await page.locator('a[href^="/envanter/"] >> text=/^Pasif$/').count()) {
    throw new Error("seçilmeyen durum listede");
  }
  log("çoklu durum seçimi çalışıyor: pasif hariç hepsi");

  // Seçili çipe tekrar dokunmak onu listeden çıkarıyor.
  await page.tap('button[aria-label="Filtreler — 1 açık"]');
  await page.tap('button[aria-label="Durum: Satıldı"]');
  await page.getByRole("button", { name: "Uygula", exact: true }).tap();
  await page.waitForURL((url) => {
    const durum = url.searchParams.get("durum") ?? "";
    return durum.includes("IN_USE") && !durum.includes("SOLD");
  });
  log("seçili çip tekrar dokununca çıkıyor");

  // Filtreyi kaldırmanın yolu panelin "Temizle"si: liste üstünde ayrı bir
  // çip şeridi yok, açık filtre sayısı düğmenin rozetinde duruyor.
  await page.tap('button[aria-label="Filtreler — 1 açık"]');
  await page.getByRole("button", { name: "Temizle", exact: true }).tap();
  await page.waitForURL((url) => !url.searchParams.has("durum"));
  log("filtre panelden temizlendi");

  // Panel açıkken geri tuşu paneli kapatmalı, sayfadan atmamalı (TUZAKLAR #17).
  // Boş formda soru sorulmuyor: kaybolacak bir şey yok.
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.waitForSelector('role=dialog');
  await page.goBack();
  await page.waitForSelector('role=dialog', { state: "detached", timeout: 5000 });
  if (!page.url().includes("/envanter")) throw new Error(`geri tuşu sayfadan attı: ${page.url()}`);
  log("geri tuşu paneli kapattı, sayfa yerinde");

  // Yazdıktan sonra çıkmak isteyince kendi onay kutumuz çıkıyor; tarayıcının
  // confirm() kutusu değil (o Playwright'ta dialog olayı olurdu).
  let tarayiciKutusu = false;
  page.on("dialog", async (d) => { tarayiciKutusu = true; await d.dismiss(); });

  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.waitForSelector('role=dialog');
  await page.fill('input[name="name"]', "Yarım kalan kayıt");
  await page.goBack();
  await page.waitForSelector("text=Kaydedilmemiş değişiklikler", { timeout: 5000 });
  if (tarayiciKutusu) throw new Error("tarayıcının confirm kutusu açıldı");
  await page.screenshot({ path: `${out}/8-onay.png` });

  // "Geri dön": panel açık kalıyor ve yazdığımız duruyor.
  await page.getByRole("button", { name: "Geri dön", exact: true }).tap();
  await page.waitForSelector("text=Kaydedilmemiş değişiklikler", { state: "detached" });
  if ((await page.inputValue('input[name="name"]')) !== "Yarım kalan kayıt") {
    throw new Error("vazgeçince form sıfırlandı");
  }

  // Geçmiş kaydı geri konmuş olmalı: ikinci geri tuşu yine paneli kapatmalı.
  await page.goBack();
  await page.waitForSelector("text=Kaydedilmemiş değişiklikler", { timeout: 5000 });
  await page.getByRole("button", { name: "Kaydetme", exact: true }).tap();
  await page.waitForSelector('role=dialog', { state: "detached", timeout: 5000 });
  if (!page.url().includes("/envanter")) throw new Error(`onaydan sonra sayfadan attı: ${page.url()}`);
  if (await page.locator('a:has-text("Yarım kalan kayıt")').count()) {
    throw new Error("kaydedilmemiş form yine de kaydedilmiş");
  }
  log("kaydedilmemiş çıkış kendi onay kutumuzla soruldu");

  // "Kaydet ve çık": aynı yerden kaydedip çıkabilmeli.
  const kaydedilen = `Kaydet ve çık ${Date.now().toString().slice(-6)}`;
  await page.tap('a[aria-label="Yeni ekipman"]');
  await page.waitForSelector('role=dialog');
  await page.fill('input[name="name"]', kaydedilen);
  await page.goBack();
  await page.waitForSelector("text=Kaydedilmemiş değişiklikler", { timeout: 5000 });
  await page.getByRole("button", { name: "Kaydet ve çık", exact: true }).tap();
  await page.waitForSelector('role=dialog', { state: "detached", timeout: 15000 });
  await page.waitForSelector(`text=${kaydedilen}`, { timeout: 20000 });
  log("kaydet ve çık kaydediyor");

  // --- 2. EDITOR: görüyor, üye ekleyemiyor ---
  const editorCtx = await browser.newContext(iphone);
  const editor = await login(editorCtx, "buketc");
  await editor.goto(`${BASE}/envanter`);
  await editor.waitForSelector(`text=${URUN}`);
  await editor.goto(`${BASE}/lokasyonlar`);
  await editor.tap('a:has-text("Ev")');
  await editor.tap('a:has-text("Üyeler")');
  await editor.waitForSelector('h1:has-text("Üyeler")');
  if (await editor.locator('button:has-text("+ Üye")').count()) {
    throw new Error("düzenleyene üye ekleme düğmesi görünüyor");
  }
  log("düzenleyen: görüyor, üye ekleyemiyor");
  await editor.screenshot({ path: `${out}/8-duzenleyen-uyeler.png` });

  // --- 3. Yabancı: hiçbir şey görmüyor ---
  const strangerCtx = await browser.newContext(iphone);
  const stranger = await login(strangerCtx, "aysek");
  await stranger.goto(`${BASE}/envanter`);
  await stranger.waitForSelector("text=Önce bir lokasyon aç");
  const locationId = new URL(page.url()).searchParams.get("lokasyon");
  const res = await stranger.goto(`${BASE}/lokasyonlar/${locationId ?? "yok"}`);
  if (res && res.status() !== 404) throw new Error(`yabancıya ${res.status()} döndü`);

  // Etiketten gelen adres: üyesi olmayan kullanıcı 404 alıyor ve ekipmanın
  // adını göremiyor. Olmayan ekipmanla aynı cevap — hangisi olduğu dışarı
  // sızmıyor.
  const urunRes = await stranger.goto(`${BASE}/envanter/${itemId}`);
  if (urunRes && urunRes.status() !== 404) {
    throw new Error(`yabancı ekipmana ${urunRes.status()} ile ulaştı`);
  }
  const yabanciGovde = await stranger.locator("body").innerText();
  if (yabanciGovde.includes(URUN)) throw new Error("ekipman adı yabancıya sızdı");
  log("yabancı: envanter boş, lokasyon ve ekipman 404");

  // Girişi olmayan hiç göremiyor: giriş sayfasına düşüyor.
  const misafirCtx = await browser.newContext(iphone);
  const misafir = await misafirCtx.newPage();
  await misafir.goto(`${BASE}/envanter/${itemId}`);
  if (!misafir.url().includes("/giris")) {
    throw new Error(`girişsiz kullanıcı ${misafir.url()} adresinde kaldı`);
  }
  if ((await misafir.locator("body").innerText()).includes(URUN)) {
    throw new Error("ekipman adı girişsiz kullanıcıya sızdı");
  }
  log("girişsiz: ekipman adresi giriş sayfasına düşüyor");
  await stranger.screenshot({ path: `${out}/9-yabanci.png` });

  console.log("\nDUMAN TESTİ GEÇTİ");
} finally {
  await browser.close();
}
