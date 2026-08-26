# Envanterim

Ev ve iş yerindeki ekipmanların envanterini tutan web uygulaması: bilgisayar,
telefon, beyaz eşya, araç… Satın alma, garanti, seri no, fatura ve fotoğraflar
tek yerde; liste eşinle, ortağınla ya da ekiple paylaşılıyor.

**Hedef cihaz iPhone 14 (390×844), arayüz Türkçe, görünüm Apple HIG'e yakın.**

## Neler var

- **Lokasyon bazlı paylaşım.** Ekipman bir lokasyona bağlı; kimin ne göreceğine
  lokasyon üyeliği karar veriyor. Roller: sahip, düzenleyen, görüntüleyen.
- **Davet kodu.** Sahip tek kullanımlık, 7 gün geçerli bir kod üretiyor; kodla
  kayıt olan kişi doğrudan o lokasyona üye oluyor.
- **Kategoriler ve dinamik alanlar.** Her kategoriye özel alan tanımlanıyor
  (ekran boyutu, yakıt tipi, şase no…). Değerler JSONB'de; doğrulama çalışma
  anında tanımlardan üretilen Zod şemasıyla yapılıyor.
- **Ekipman kaydı.** Ad, marka, model, seri no, yer, kategori, satıcı, alış
  tarihi ve tutarı, garanti bitişi, yaşam döngüsü durumu.
- **Arama ve filtre.** Ada/markaya/modele/seri numarasına göre arama; durum,
  lokasyon ve kategori filtresi; kalan garanti günü rozeti.
- **Fotoğraf ve belge.** Ürün fotoğrafı, fatura, garanti belgesi, kılavuz.
  Fotoğraf yüklemeden önce istemcide küçültülüyor; PDF ayrı ele alınıyor.
- **Faturadan otomatik doldurma.** Fatura PDF'i ya da fotoğrafı tek Claude
  çağrısıyla okunuyor, alanlar forma dolduruluyor — **kaydeden kullanıcı.**
- **e-Arşiv/e-Fatura XML'i.** Veri faturanın kendisinden okunuyor; modele hiç
  gidilmiyor.
- **Zimmet — teslim–tesellüm.** Ekipman bir kişiye zimmetlenir; kişi "üzerime
  al" diyene kadar teslim sayılmaz ve raporda durur. Devir, iade ve red kayıtlı;
  atanan kişiye bildirim gider. Sorumlu lokasyon üyesi olabilir, hesabı olmayan
  biri de — ikincisinde teslimi sahibi onun adına işaretler, kimin işaretlediği
  kayda geçer.
- **Alt ekipman.** Lisans, hoparlör, klavye… ana ekipmana bağlanır. Her biri
  kendi garantisi ve faturası olan tam bir ekipman; zimmet ve devir birlikte
  işler, maliyet "bileşenlerle birlikte" de görünür.
- **Zaman çizelgesi.** Servis, sayaç okuması, olay günlüğü ve zimmet tek
  listede; sahip olma maliyeti (alış + servis + parça) hesaplanıyor.
- **Bakım ve garanti hatırlatmaları.** "6 ayda bir" ya da "her 10.000 km'de";
  garanti bitimine 30 ve 7 gün kala web push.
- **QR etiket ve kamerayla okutma.** Etiketi cihaza yapıştır; telefonun
  kamerasıyla okutunca ürün açılır. Cihazın kendi barkodu seri numarasında
  aranır — kamera ne görürse görsün nereye gidileceğine sunucu karar verir.
- **Sigorta raporu ve CSV.** Sigortaya fotoğraflı döküm ver; envanteri
  Excel'e aktar, düzenleyip geri yükle.
- **Salt-okunur paylaşım linki.** Servise giderken teknisyen geçmişi hesap
  açmadan görür; tutarlar paylaşılmaz.
- **Kaydırma jestleri.** Envanter satırını sola çekince hızlı işlem; zaman
  çizelgesinde silme "geri al" şeridiyle geliyor.

Öncelik listesi ve sıradaki özellikler: [`docs/URUN.md`](docs/URUN.md).

## Yığın

Next.js 15 App Router · TypeScript · Tailwind · Prisma + PostgreSQL (Supabase) ·
NextAuth (credentials) · Vitest + Playwright · Vercel · Claude API

## Başlarken

```bash
cp .env.example .env      # iki veritabanı bağlantısı + NEXTAUTH_SECRET
npm install
npm run db:migrate        # şemayı kur
npm run create-admin      # ilk hesap
npm run dev               # http://localhost:3000
```

`NEXTAUTH_SECRET` için `openssl rand -base64 32`. Supabase, Anthropic ve SMTP
değişkenleri tanımsızken de çalışır: dosyalar yerel diske düşer, faturadan
okuma ve e-posta bildirimi arayüzde görünmez.

Kamerayla okutma için gereken `.wasm` dosyası `npm install` sırasında
`public/zxing/` altına kopyalanır (`scripts/copy-zxing.mjs`); dış bir CDN'den
indirilmez. Kamera yalnız `https` ya da `localhost` üzerinde açılır.

Arayüzü tarayıcının iPhone profilinde (390×844, dokunmatik) aç — masaüstünde
fareyle bakmak yetmiyor.

## Komutlar

```bash
npm run dev              # geliştirme
npm test                 # Vitest (saf mantık modülleri)
npm run typecheck        # tsc --noEmit
npm run build            # prisma generate + next build
npm run db:migrate       # şema göçü (geliştirme)
npm run db:deploy        # şema göçü (üretim)
npm run create-admin     # ilk hesap
```

Commit öncesi üçü de temiz olmalı: `npm run typecheck`, `npm test`,
`npm run build`.

## Dağıtım

Supabase + Vercel kurulumu, göç sırası, depolama kovası, ilk hesap ve duman
testi: [`DEPLOY.md`](DEPLOY.md).

## Mimari kararlar nerede

| Dosya | İçerik |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Değişmez kurallar — ajan her oturumda okur |
| [`docs/MIMARI.md`](docs/MIMARI.md) | Veri modeli, yetki deseni, dinamik alanlar, bildirimler, faturadan okuma |
| [`docs/TASARIM.md`](docs/TASARIM.md) | iOS görünümü: tipografi, renk, dokunma hedefi, güvenli alan |
| [`docs/URUN.md`](docs/URUN.md) | Benzer uygulamalar ve öncelikli özellik listesi |
| [`docs/TUZAKLAR.md`](docs/TUZAKLAR.md) | Bu yığında gerçekten yaşanmış 46 hata ve çözümü |

Kural `CLAUDE.md`'de, gerekçe `docs/`'ta durur: ajanın davranışını değiştiren
şey bağlamda sürekli duran kısa kurallardır; uzun mimari yazısı bir kez okunur.

## Yerleşim

```
src/
├── app/
│   ├── (uygulama)/          # giriş isteyen ekranlar + alt sekme çubuğu
│   │   ├── envanter/        # liste, ekipman detayı, düzenleme, ekler
│   │   ├── lokasyonlar/     # lokasyon, üyeler, davetler, kategoriler
│   │   └── hesap/
│   ├── api/                 # route handler'lar — hepsi Zod'dan geçer
│   │   └── tara/            # kamerayla QR/barkod okutma
│   ├── giris/ · kayit/ · p/   # p/: girişsiz salt-okunur paylaşım sayfası
├── components/              # iOS desenleri: liste, panel, form, sekme çubuğu
└── lib/                     # saf mantık + testleri, yetki, depolama, Claude
prisma/                      # şema ve göçler
scripts/create-admin.ts
```

Saf mantık `src/lib/` içinde ve testli: garanti günü hesabı, para (kuruş),
yetki kuralları, dinamik alan doğrulaması, davet kodu, yükleme kuralları,
faturadan gelen alanların forma dönüşümü, CSV, e-Fatura ayrıştırma, bakım
kuralları, sigorta raporu özeti, QR ve paylaşım bağlantıları, okutulan kodun
çözümü, zimmet durumu, alt ekipman bağı ve kaydırma jestinin matematiği.
