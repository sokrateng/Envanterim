# Mimari — Envanter Takip

Yığın ve desenler, uçtan uca çalıştırılmış bir projeden (GeziPay) taşınıyor.
Her maddede **neden** o seçim yapıldığı var.

## 1. Yığın

**Vercel + Next.js App Router** — ayrı backend yok; API uçları da sayfalar da
aynı projede sunucusuz fonksiyon olarak koşar.
**Supabase** — yönetilen Postgres + dosya depolama, aynı sağlayıcıda.
**Prisma** — tek şema dosyası, tip güvenli sorgu, göç yönetimi.
**NextAuth (credentials)** — kullanıcı adı + şifre. E-posta doğrulama, SMTP ve
OAuth derdi yok; davetle büyüyen kapalı bir sisteme uyuyor.

### Bağlantı ayrımı (atlanırsa göç kırılır)

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")  // havuzlanmış (Supabase pooler, 6543)
  directUrl = env("DIRECT_URL")    // doğrudan (5432) — migrate/db push
}
```

Pooler adresi bölgeye göre değişir; panelden kopyala, tahmin etme.

## 2. Sahiplik ve paylaşım — en temel karar

**Paylaşımın birimi lokasyondur.** Kullanıcı "Ev", "Şirket", "NetBT" gibi
lokasyonlar açar; ekipman lokasyona bağlıdır; lokasyona kimin ne yetkiyle
erişeceği `LocationMember` ile belirlenir.

```
enginc → Ev      (OWNER)   ← buketc (EDITOR), eylulc (VIEWER)
       → Şirket  (OWNER)
akars  → NetBT   (OWNER)   ← paylaşmazsa yalnız kendisi görür
```

Neden ayrı bir "çalışma alanı" katmanı yok: lokasyon zaten kullanıcının kafasındaki
ayrım. Üstüne bir katman koymak her ekranda gereksiz bir seçim yaratırdı.

**Kullanıcı adı global tekil.** Ayrık şirketler yok; paylaşım kullanıcılar arası
davetle oluyor, dolayısıyla tek ad alanı doğru. (Ayrık şirket kodları
gerekirse `@@unique([tenantId, username])`'a geçmek gerekir — o zaman gelen bir
karar, şimdi değil.)

### Roller

| Rol | Görür | Ekler/düzenler | Üye yönetir | Kategori/alan tanımlar |
|---|---|---|---|---|
| `OWNER` | ✅ | ✅ | ✅ | ✅ |
| `EDITOR` | ✅ | ✅ | — | — |
| `VIEWER` | ✅ | — | — | — |

### Yetki deseni

Tek yerde toplanıp her uçta çağrılır:

```ts
requireLocation(locationId)          // null → üye değil
requireLocationEditor(locationId)    // null → üye değil · "readonly" → yetkisiz
canManageMembers(member)             // saf fonksiyon, testli
```

Saf yetki fonksiyonları veritabanına dokunmaz; hem uçlarda hem sayfa üretirken
kullanılır ve testleri kolaydır.

## 3. Veri modeli

```
User                id, name, username@unique, passwordHash, status, inviteCode
                    status: PENDING | ACTIVE | FROZEN

Location            id, name, icon, createdAt
                    members[], items[], categories[], vendors[]

LocationMember      id, locationId, userId, role (OWNER|EDITOR|VIEWER)
                    @@unique([locationId, userId])

Category            id, locationId, name, icon
                    fields[]         // dinamik alan tanımları
                    ↳ lokasyona ait: her kullanıcı kendi kategorilerini kurar

CategoryField       id, categoryId, key, label, order, required
                    type: TEXT | NUMBER | DATE | SELECT | BOOL
                    options Json?    // SELECT için seçenekler

Vendor              id, locationId, name, phone, email, website, address, note
                    isSeller Bool, isService Bool
                    ↳ satıcı ve yetkili servis iki ayrı iş; listeler role göre
                      süzülüyor (src/lib/vendors.ts). Aynı tabloda duruyorlar
                      çünkü bir firma ikisini birden yapabiliyor — iki bayrak,
                      tek kayıt.
                    ↳ seçim lokasyondan bağımsız: kullanıcının üyesi olduğu
                      bütün lokasyonların firmaları listeleniyor. locationId
                      yine duruyor, çünkü yetki lokasyon üyeliğinden geçiyor
                      (CLAUDE.md) — kaydın çapası o.

Item                id, locationId, categoryId?, name, brand?, model?, serialNo?
                    place?           // oda/raf — serbest metin
                    sellerId?        // nereden alındı → Vendor
                    purchaseDate?, purchasePriceMinor?, currency
                    warrantyEndDate?
                    status: IN_USE | IN_REPAIR | RETIRED | SOLD
                    customFields Json    // CategoryField'lara göre değerler
                    parentId?        // bileşense ana ekipman → Item
                    attachments[], events[], parts[], reminders[], assignments[]

ItemAssignment      id, itemId, assignedById, assignedAt, note?
                    holderUserId? | holderName?   // üye ya da hesapsız kişi
                    acceptedAt?, acceptedById?
                    closedAt?, closedById?, closedReason: RETURN|TRANSFER|DECLINE
                    ↳ durum alanı yok: tarihlerden türetiliyor

Attachment          id, itemId, url, name, uploadedAt
                    kind: PHOTO | INVOICE | WARRANTY | MANUAL | OTHER

ItemEvent           id, itemId, date, kind, note?
                    kind: READING | SERVICE | LOG | ASSIGNMENT
                    readingValue?, readingUnit?   // km, saat, sayfa
                    costMinor?, vendorId?         // servis maliyeti
                    assignedToUserId?, assignedPlace?

Part                id, itemId, name, partNo?, priceMinor?, vendorId?, stock?

ItemReminder        id, itemId, kind (WARRANTY|MAINTENANCE), dueDate, leadDays, sentAt?
```

### Zimmet: teslim–tesellüm

Ekipmanın "şu anki sorumlusu" bir sütun değil, **kapanmamış `ItemAssignment`
kaydı**. Durum (bekliyor / üzerinde / iade / devir / red) tarihlerden
türetiliyor; türetilmiş değer saklanmıyor.

Atama tek başına teslim sayılmıyor. Karşı taraf "üzerine alana" kadar kayıt
`PENDING` kalıyor ve raporda duruyor — teslim–tesellümün bütün değeri bu
onayda. Onayı ya kişinin kendisi veriyor ya da hesabı olmayan biri için
sahibi/düzenleyen onun adına işaretliyor; **kimin işaretlediği** `acceptedById`
/ `closedById` ile kayıtta.

Sorumlu iki türlü olabilir: lokasyonun bir üyesi (`holderUserId` — kendi
onayını verir, bildirim alır) ya da hesabı olmayan bir kişi (`holderName` —
ev halkının tamamının hesabı olmuyor). Ad kimlik değildir: iki kişi aynı adı
taşıyabilir, bu yüzden üye tarafında her zaman kimliğe bakılıyor
(TUZAKLAR #46).

Devir ayrı bir uç değil: açık zimmet varken yeni zimmet açmak devirdir, eskisi
`TRANSFER` ile kapanır. Bileşenler varsayılan olarak ana ekipmanla birlikte
gider — telefon el değiştirirken lisansı elde kalmasın.

### Alt ekipman

`Item.parentId` ile kendine ilişki. Alt ekipman **tam bir ekipman**: kendi
garantisi, faturası, QR'ı ve maliyeti var; ana ekipmana bağlı olması yalnız
"bunlar birlikte gezer" demek. Ayrı bir tablo açmak, lisansı da hoparlörü de
ikinci sınıf bir kayda düşürürdü.

Kurallar saf modülde (`src/lib/components.ts`): çember yok, aynı lokasyon
zorunlu, zincir en çok üç kademe. Maliyet lokasyon toplamında her ekipmanı bir
kez sayıyor; "bileşenlerle birlikte" toplamı yalnız ekipman sayfasında.

### Neden tek `ItemEvent` tablosu

"Tarihsel kullanım bilgisi" dört ayrı ihtiyaç olabilir: sayaç okuması (araba km),
olay günlüğü ("pil değişti"), zimmet geçmişi (kime verildi), maliyet geçmişi
(servise ne ödendi). Dördü de **aynı şey**: bir tarihte olan, ekipmana bağlı bir
kayıt. Tek tablo + `kind` alanı hepsini karşılıyor; ürün zaman çizelgesi tek
sorguyla geliyor ve dördünden hangisini kullanacağınıza sonra karar verebiliyorsunuz.

**Dördü de kapsamda** (kullanıcı onayı alındı): `READING` sayaç okuması,
`LOG` olay günlüğü, `ASSIGNMENT` zimmet geçmişi, `SERVICE` servis + maliyet.
Ürün sayfasında hepsi tek zaman çizelgesinde görünür, tür rozetiyle ayrılır;
filtre ile yalnızca bir tür gösterilebilir.

`READING` ayrıca bakım hatırlatmasını sürebilir: "her 10.000 km'de servis"
kuralı son okuma değerine bakar. Bu yüzden okuma değeri metin değil `Float`.

### Dinamik alanlar: JSONB, EAV değil

`Item.customFields` bir `Json` sütunu; `CategoryField` tanımları arayüzü ve
doğrulamayı sürüyor.

**Neden EAV değil:** her alan için ayrı satır tutmak, liste ekranında her ürün
için N join demek. Değerler zaten hep ürünle birlikte okunuyor.

**Bedeli:** veritabanı tip zorlaması yok. Doğrulama uygulamada — `CategoryField`
tanımlarından çalışma anında Zod şeması üretilir. Bu adım atlanırsa bozuk veri
girer. Özel alana göre filtreleme gerekirse Postgres GIN indeksi eklenir.

## 4. Bildirimler

**Garanti uyarısı** Vercel Cron ile günde bir çalışan bir uçtan gider:
`warrantyEndDate` bugünden 30 ve 7 gün sonrasına düşen ürünler bulunur, o
lokasyonun üyelerine web push gönderilir. Gönderilen uyarı `ItemReminder.sentAt`
ile damgalanır — yoksa her gün tekrar gider.

Web push VAPID ile; abonelik kullanıcı başına saklanır. **Bildirimi mutlaka
`await` et** (TUZAKLAR #1). E-posta ikinci kanal olarak eklendi: `Reminder`
modeli kanaldan bağımsız olduğu için aynı damga ikisini birden kapsıyor ve
aynı hatırlatma iki kez gitmiyor. E-posta yalnız doğrulanmış adrese gider.

**Zimmet bildirimi** hatırlatma değil, bir istekten haber vermek: atanan kişiye
push ve e-posta gidiyor, cevabı (kabul/red) atayana dönüyor. Damga yok, çünkü
her atama tek seferlik bir olay.

**Envanter bildirimleri** (yeni ekipman, ekipman değişikliği) aynı desende:
lokasyonun diğer üyelerine gidiyor, işi yapana gitmiyor (kendi yaptığı işin
bildirimi gürültü). Bildirim yan iş — başarısız olsa da kayıt yazılmış oluyor
(TUZAKLAR #51).

Tercih **kullanıcıda ve kanaldan bağımsız**: `User.notifyNewItem` /
`notifyItemChange` kapalıysa ne push ne e-posta gider. Aynı lokasyondaki iki
kişi farklı seçebiliyor. E-posta ayrıca doğrulanmış adres ve açık
`emailReminders` istiyor — yani iki kapı: "bu olayı duymak istiyorum" ve "bana
e-posta gönderilebilir".

Değişiklik bildirimi **ne değiştiğini** yazıyor (`src/lib/item-changes.ts`,
saf ve testli): "güncellendi" demek kullanıcıyı uygulamayı açıp aramaya
zorluyor. Değişmeyen alan listeye girmiyor; hiçbir alan değişmediyse bildirim
hiç gönderilmiyor.

### Çevrimdışı

Service worker uygulama açılınca kaydoluyor (bildirimden bağımsız). Gezinme
istekleri önce ağdan, olmazsa o adresin son kopyasından, o da yoksa
`/cevrimdisi`'nden karşılanıyor; App Router'ın RSC yükleri de saklanıyor,
yoksa uygulama içinde tıklayarak gezinmek ağsız çalışmıyor (TUZAKLAR #48).
`/api/*` hiç önbelleğe girmiyor.

Önbellekte oturum açmış kullanıcının gördüğü sayfalar duruyor; çıkışta
temizleniyor — ortak cihazda bir sonraki kullanıcı öncekinin envanterini
görmesin.

### Denetim izi

`AuditLog`: kim neyi sildi, kimin yetkisi değişti. Ekipman silinmiyor ama
olay, parça ve ek siliniyor; paylaşılan bir envanterde "bu nereye gitti"
sorusunun tek cevabı bu. Yazmak sessizce başarısız oluyor — iz tutulamadı
diye kullanıcının işlemi geri alınmaz. Ekran yalnız sahibe açık.

## 5. Dosya depolama

Supabase Storage'a düz `fetch` ile yazılır, SDK eklenmez (soğuk başlangıç hafif
kalsın). Ortam değişkenleri tanımsızsa yerel diske düşer; böylece Supabase
kurmadan geliştirme çalışır.

Fatura PDF'i, garanti belgesi ve kılavuz da aynı yoldan gider — `Attachment.kind`
ayırır. Fotoğraflar yüklemeden önce istemcide küçültülür.

## 6. Faturadan veri çıkarma

**Karar: tek Claude çağrısı, ayrı OCR katmanı yok.** Claude API belge ve görsel
girdisini doğrudan alıyor — PDF'i `document`, fotoğrafı `image` içerik bloğu
olarak gönderiyorsun, yapılandırılmış çıktı ile şemana uyan JSON dönüyor.
Tesseract benzeri bir OCR katmanı kurup üstüne LLM eklemek iki sistem bakmak
demek olurdu ve sonucu daha kötü olurdu.

**"Ayrı backend" endişesi geçersiz:** çağrı bir Next.js route handler'ından
`@anthropic-ai/sdk` ile yapılıyor. Vercel'de koşan aynı sunucusuz fonksiyon.
Ek servis, ek dağıtım, ek altyapı yok.

### Üç kaynak, azalan kesinlik sırasıyla

| Kaynak | Yöntem | Kesinlik |
|---|---|---|
| **e-Arşiv / e-Fatura XML** | Deterministik ayrıştırıcı, model yok | Tam — veri zaten yapısal |
| **PDF (metin katmanlı)** | Claude `document` bloğu | Çok yüksek — model gerçek metni okur |
| **Fotoğraf / taranmış PDF** | Claude `image` / `document` bloğu | Yüksek ama tahmini |

XML varsa modele hiç gitme: hem bedava hem kesin. Türkiye'de elektronik ürün
alışlarının çoğu e-Arşiv faturasıyla geliyor.

### Akış

İki giriş noktası var, ikisi de aynı çıkarma katmanını kullanıyor
(`src/lib/invoice-read.ts`: tür denetimi, saatlik sınır, sayaç, yanıt biçimi):

```
Var olan ekipmanın ekinden:
  ek → Supabase Storage → sunucu okur → model → JSON → forma doldur
     → KULLANICI ONAYLAR → kaydet

Yeni ekipman formundan (ekipman henüz yok):
  dosya → doğrudan gövdede sunucuya → model → JSON → forma doldur
        → KULLANICI ONAYLAR → ekipman açılır → aynı dosya ek olarak yüklenir
```

İkincisinde dosya depoya yazılmıyor: bağlanacağı ekipman henüz yok ve okuma
hiçbir şey kaydetmiyor. Yetki lokasyon üyeliğinden geçiyor (CLAUDE.md) — okuma
bir lokasyonun kotasını harcıyor. `InvoiceRead.itemId` bu yüzden boş
bırakılabiliyor.

**Kullanıcı onayı adımı atlanamaz.** Fotoğraftan okuma hiçbir zaman %100 kesin
olamaz — bu OCR'ın değil problemin doğası. Alanları forma doldurup kullanıcıya
tek bakışta doğrulatmak, "kesin" sonucun pratikteki karşılığıdır. GeziPay'de
onay/yeniden çek adımı bu yüzden eklendi.

### Çağrının şekli (TypeScript)

```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();   // ANTHROPIC_API_KEY sunucuda

const response = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  output_config: {
    effort: "low",              // iyi tanımlı çıkarma işi; gecikmeyi düşük tutar
    format: { /* JSON şeması: satıcı, tarih, seri no, model, tutar, kalemler */ },
  },
  messages: [{
    role: "user",
    content: [
      // Belge bloğu METİN BLOĞUNDAN ÖNCE gelmeli
      { type: "document", source: { type: "base64",
        media_type: "application/pdf", data: base64Pdf } },
      { type: "text", text: "Bu faturadan ekipman bilgilerini çıkar." },
    ],
  }],
});
```

Fotoğraf için `document` yerine `{ type: "image", source: { type: "url", url } }`
— dosya zaten Supabase'de olduğu için URL yeterli, base64'e çevirmeye gerek yok.

> Yapılandırılmış çıktı için `output_config.format` kullanılır; eski
> `output_format` parametresi kullanımdan kalktı. `client.messages.parse()`
> yanıtı şemaya göre doğrular — tercih edilen yol.

### İkinci sağlayıcı: Azure AI Foundry

Anthropic anahtarı olmayan kurulumlar için OpenAI uyumlu bir dağıtım da
kullanılabiliyor (`AZURE_AI_ENDPOINT`, `AZURE_AI_DEPLOYMENT`). `ANTHROPIC_API_KEY`
varsa o öncelikli; yoksa Azure yolu devreye giriyor. Seçim `extractionProvider()`
içinde tek yerde.

Sözleşme farklı ama **şema aynı**: `INVOICE_JSON_SCHEMA` iki sağlayıcıya da
gidiyor, dönen JSON iki durumda da `extractedInvoiceSchema` ile doğrulanıyor.
Böylece uygulamanın gördüğü tip sağlayıcıdan bağımsız.

```ts
// src/lib/openai-responses.ts — saf: gövde kurma + yanıt okuma (testli)
// src/lib/azure-llm.ts        — ağ: yapılandırma, jeton, fetch
{
  model: "gpt-5.6-sol",              // Azure'da DAĞITIM adı (TUZAKLAR #54)
  instructions: SYSTEM,
  input: [{ role: "user", content: [
    { type: "input_file", filename: "fatura.pdf",
      file_data: "data:application/pdf;base64,…" },   // dosya bloğu ÖNCE (#33)
    { type: "input_text", text: "Bu faturadan ekipman bilgilerini çıkar." },
  ]}],
  text: { format: { type: "json_schema", name: "fatura", strict: true, schema } },
}
```

Yanıtta metin `output` dizisinin ilk elemanı değil: akıl yürüten dağıtımlarda
önce `reasoning` bloğu geliyor (TUZAKLAR #53). Kimlik ya kaynak anahtarı ya da
Entra ID uygulama kaydı; `DefaultAzureCredential` sunucusuzda çalışmıyor (#55).
`npm run llm:test` üç denemeyle erişimi, şemayı ve belge okumayı ölçüyor.

### Maliyet

Claude Opus 5: girdi $5/1M, çıktı $25/1M token. Tek sayfalık bir fatura kabaca
2.500 girdi + 400 çıktı token → **fatura başına ~$0,02 (~0,9 TL)**.

Yılda 20 ürün ekleyen bir ev kullanıcısı için yılda 20 TL — önemsiz. Hacim
artarsa daha ucuz bir model ölçülüp seçilebilir; bu sizin kararınız, varsayılan
olarak düşürmüyorum.

### Sınırlar (dağıtımdan önce bilinmesi gerekenler)

- **Vercel istek gövdesi ~4,5 MB.** Telefon fotoğrafı bunu aşabilir. Dosyayı
  önce Supabase Storage'a yükle, route handler oradan okusun. İstemcide
  küçültme (GeziPay'deki `image-client.ts`) yine de ilk savunma.
- **Fonksiyon süresi.** Çıkarma çağrısı saniyeler sürer; route'ta
  `export const maxDuration = 60` ayarla ve planının sınırını doğrula.
- **API anahtarı yalnız sunucuda.** Ne `ANTHROPIC_API_KEY` ne `AZURE_AI_*`
  değerleri `NEXT_PUBLIC_` olur; istemciden çağrı yapılmaz.
- **Kullanıcı başına hız sınırı koy.** Yükleme ucu kimlik doğrulamalı olmalı ve
  makul bir sayıda çağrıyla sınırlanmalı.
- Claude belge girdisi sınırı: istek başına 32 MB, 600 sayfa.

### Yetkili servis

`ServiceJob` süren bir işi tutuyor: gönderildi → bekliyor → döndü. Zaman
çizelgesindeki `SERVICE` olayı tek bir ana ait, bu yüzden ayrı model.

- **Durum kayıtla birlikte değişiyor.** Kayıt açılınca `IN_REPAIR`, sonuç
  girilince `IN_USE` — açık başka iş yoksa. Kararı `statusAfterService` veriyor
  (saf, testli); pasif ve satılmış ekipman kullanıma dönmüyor, o karar servis
  kaydından daha yeni ve daha bilinçli.
- **Ücret tek yerde.** Servis ücreti `ServiceJob.costMinor`'da duruyor ve sahip
  olma maliyetine oradan giriyor; ayrıca `ItemEvent` açılmıyor, yoksa aynı
  gider iki kez sayılırdı. Garanti kapsamındaki iş toplama girmiyor — kimse
  ödemedi.
- `ServiceJob.trackingUrl`: servisin durum sayfası. Adres verildiyse fiş
  numarası bağlantının kendisi oluyor — kullanıcı numarayı kopyalayıp sitede
  aratmıyor.
- Servis firması `Vendor` (satıcıyla aynı tablo, `isService` bayrağı); servis
  formunda yalnız `isService` olanlar listeleniyor. Telefon ve web adresi
  servis kaydının yanında dokunulabilir bağlantı olarak duruyor: servisteki
  ekipmanın sahibinin ilk işi aramak. Adres `src/lib/vendor-contact.ts`'ten
  geçiyor — kullanıcının yazdığı metin doğrudan `href` olmuyor. Firmalar Hesap → Firmalar
  ekranından yönetiliyor: kullanılan firma silinmiyor, adı düzeltiliyor ya da
  rolü kapatılıyor.

### Notlar ve puan

`ItemNote` ekipmanın "nasıl kullanılıyor" tarafı: tarif, ayar, uyarı. Yazarın
adı kayda düşüyor (`authorName`) — hesap silinse de "kim yazmış" kalsın.
Fotoğraflar ayrı bir tabloya değil, `Attachment.noteId` ile aynı tabloya
gidiyor: depolama yolu, silme ve boyut kuralı tek yerde kalsın. `noteId` dolu
olan dosya ekipmanın genel ekler bölümünde çıkmıyor.

`ItemRating` kişi başına tek puan (`@@unique([itemId, userId])`). Ortalama
saklanmıyor, `averageStars` ile hesaplanıyor (CLAUDE.md).

Servis kaydı **düzenleme** yetkisi istiyor (envanter verisi); not ve puan
**üyelik** yetiyor. Not yazmak ve puan vermek üyeliğe bağlı, düzenleme yetkisine değil:
ekipmanı kullanan kişi çoğu zaman düzenleyen değil, tarifi ve beğeniyi o
biliyor. Notu yalnız yazarı düzenleyebiliyor; silmeyi yazar ve lokasyon sahibi
yapabiliyor (`src/lib/notes.ts`, testli).

## 7. Test stratejisi

- **Saf mantık → Vitest.** Garanti günü hesabı, sahip olma maliyeti,
  amortisman, dinamik alan doğrulaması, yetki fonksiyonları.
- **Arayüz → Playwright.** iPhone profilinde gerçek dokunma olaylarıyla
  (CDP `Input.dispatchTouchEvent`).
- **Testi değil kodu düzelt.** Test patlıyorsa önce "kod mu hatalı" diye bak.

## 8. Sıfırdan kurulum sırası

Adım atlamak sonradan göç yazdırır.

1. `create-next-app` (TypeScript, Tailwind, App Router)
2. Prisma + Postgres — `directUrl`'ü **baştan** ekle
3. `src/lib/money.ts` + `src/lib/warranty.ts` gibi saf çekirdek + testleri
4. NextAuth (credentials) + `User.status`
5. `Location` + `LocationMember` + yetki yardımcıları — **uçları yazmadan önce**
6. `scripts/create-admin.ts` — üretimde giriş yapacak kimse olmadan dağıtma
7. `DEPLOY.md` — bucket, ortam değişkenleri, göç, duman testi
8. Sonra özellikler (`docs/URUN.md` sırasıyla)
