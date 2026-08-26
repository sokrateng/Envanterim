# Dağıtım — Vercel + Supabase

Sıra önemli: veritabanı → şema → ortam değişkenleri → ilk hesap → duman testi.

## 1. Supabase projesi

1. Yeni proje aç, bölgeyi Türkiye'ye yakın seç (`eu-central-1`).
2. **Settings → Database → Connection string**'den iki adresi de kopyala:
   - **Transaction pooler (6543)** → `DATABASE_URL`
   - **Direct connection (5432)** → `DIRECT_URL`

   Pooler adresi bölgeye göre değişir; panelden kopyala, tahmin etme.
   İkisi ayrılmazsa göç takılır (docs/TUZAKLAR.md #3).
3. Ücretsiz proje bir hafta kullanılmazsa duraklar; uygulama birden
   veritabanına ulaşamaz, panelden uyandırılması gerekir (#6).

## 2. Yerelde çalıştırma

```bash
cp .env.example .env          # iki bağlantı + NEXTAUTH_SECRET doldur
npm install
npm run db:migrate            # prisma migrate dev
npm run create-admin          # ilk hesap
npm run dev                   # http://localhost:3000
```

`NEXTAUTH_SECRET` için: `openssl rand -base64 32`.

Arayüzü iPhone 14 profilinde (390×844, dokunmatik) test et — masaüstü fare ile
bakmak yetmiyor (docs/TASARIM.md).

> Açık `npm run dev` varken `npm run build` çalıştırma: ikisi de `.next`'e
> yazar ve dev sunucusu çöker (docs/TUZAKLAR.md #2).

## 3. Vercel

1. Depoyu içe aktar (Framework: Next.js, kök dizin `.`).
2. **Settings → Environment Variables** (Production + Preview):

   | Değişken | Değer |
   |---|---|
   | `DATABASE_URL` | pooler (6543) adresi |
   | `DIRECT_URL` | doğrudan (5432) adres |
   | `NEXTAUTH_SECRET` | rastgele 32 bayt |
   | `NEXTAUTH_URL` | `https://<proje>.vercel.app` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role anahtarı — **yalnız sunucu** |
   | `SUPABASE_BUCKET` | `ekler` |
   | `ANTHROPIC_API_KEY` | faturadan okuma için — **yalnız sunucu** |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | garanti bildirimi (açık anahtar) |
   | `VAPID_PRIVATE_KEY` | garanti bildirimi — **yalnız sunucu** |
   | `VAPID_SUBJECT` | `mailto:sen@example.com` |
   | `CRON_SECRET` | cron ucunu korur |

3. Build komutu `npm run build` — içinde `prisma generate` var, ayrıca
   ayarlamana gerek yok.

## 4. Üretimde şema göçü

Göç adımı **her dağıtımda** çalışmalı; yerelde çalışıp üretimde unutulursa
`P2021: table does not exist` gelir (docs/TUZAKLAR.md #7).

```bash
# yerelden, üretim DIRECT_URL'i ile:
DIRECT_URL="…5432…" DATABASE_URL="…6543…" npm run db:deploy
```

Şema daha önce `db push` ile kurulduysa göç geçmişi yoktur; veri kaybetmeden
temel almak için (docs/TUZAKLAR.md #4):

```bash
npx prisma migrate diff --from-empty \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init
```

Bu depoda `prisma/migrations/0_init/migration.sql` hazır: boş bir veritabanında
`npm run db:deploy` yeter.

## 5. Depolama kovası

Supabase panelinde **Storage → New bucket → `ekler`** aç (public okuma yeterli;
uygulama yazmayı `service_role` ile yapıyor).

Bu değişkenler tanımsızsa yükleme yerel diske (`.uploads/`) düşer. Geliştirmede
işe yarar, **üretimde kullanılamaz**: sunucusuz dosya sistemi kalıcı değildir,
dağıtım sonrası dosyalar kaybolur.

Yükleme yolunda bilinen sınırlar: istek gövdesi ~4,5 MB (uygulama 4 MB'da
kesiyor), fotoğraf yüklemeden önce istemcide 2000 px kenara küçültülüyor,
Supabase'e yazarken `apikey` başlığı da gönderiliyor (docs/TUZAKLAR.md #5).

## 6. İlk hesap

Üretim veritabanına giriş yapacak kimse olmadan dağıtma:

```bash
DATABASE_URL="…üretim pooler…" npm run create-admin -- "Engin C" enginc "uzun-bir-sifre"
```

## 7. Faturadan otomatik doldurma

`ANTHROPIC_API_KEY` tanımlıysa ekipman sayfasındaki fatura eklerinde
"Faturadan doldur" düğmesi çıkar; tanımsızsa özellik arayüzde hiç görünmez.

- Model `claude-opus-5`, tek çağrı, ayrı OCR katmanı yok (docs/MIMARI.md §6).
- Maliyet: tek sayfalık fatura kabaca 2.500 girdi + 400 çıktı token →
  **fatura başına ~$0,02**.
- Kullanıcı başına saatte 20 okuma sınırı var; her okuma `InvoiceRead`
  tablosuna yazılıyor, harcamayı buradan görebilirsin:

  ```sql
  select date_trunc('day', "createdAt") gun, count(*), sum("inputTokens"), sum("outputTokens")
  from "InvoiceRead" group by 1 order by 1 desc;
  ```

- Route'ta `maxDuration = 60`; Vercel planının fonksiyon süresi üst sınırını
  doğrula (docs/TUZAKLAR.md #32).
- Çıkarılan alanlar **kaydedilmiyor**: forma doldurulup kullanıcıya
  onaylatılıyor (#36).

## 8. Garanti bildirimi (web push + cron)

1. Anahtarları üret ve ortam değişkenlerine koy:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. `vercel.json` cron'u tanımlı: `/api/cron/garanti` her gün 06:00 UTC'de
   çalışır. Vercel isteği `Authorization: Bearer $CRON_SECRET` ile gönderir;
   `CRON_SECRET` tanımlıysa uç başka isteği kabul etmez.
3. Uç, garanti bitimine **30 ve 7 gün** kalan (kullanımda ya da serviste olan)
   ekipmanları bulur, o lokasyonun üyelerine push gönderir.
4. Damga gönderimden **önce** yazılır: cron aynı işi yeniden tetiklerse
   kullanıcı aynı uyarıyı iki kez almaz (docs/TUZAKLAR.md #28).
5. `410 Gone` dönen abonelik silinir (#29).
6. Elle denemek için:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<proje>.vercel.app/api/cron/garanti
   ```

   Yanıt: `{"bakilan":…,"planlanan":…,"gonderilen":…,"atlanan":…}`.

**iOS notu:** iPhone'da web push yalnız ana ekrana eklenmiş uygulamada
çalışır. Hesap sekmesindeki anahtar bunu söyleyip kullanıcıyı yönlendirir.

## 9. Duman testi (dağıtımdan sonra)

1. `/giris` → ilk hesapla gir.
2. Lokasyon oluştur → listede görünüyor mu?
3. Hesabı olan birini `+ Üye` ile ekle, rolünü `EDITOR` yap.
4. `+ Davet` ile kod üret; koddaki bağlantıyı gizli pencerede aç, hesap
   oluştur — kişi doğrudan o lokasyona verdiğin rolle üye olmalı. Aynı kodu
   ikinci kez kullanmayı dene: "Bu davet kodu kullanılmış" demeli.
5. `Envanter` sekmesinde ekipman ekle: ad + garanti bitiş tarihi.
6. Garanti rozeti doğru gün sayısını yazıyor mu?
7. İkinci kullanıcıyla gir: aynı ekipmanı görüyor, üye ekleyemiyor.
8. Ekipmana bir fotoğraf ve bir fatura PDF'i ekle; fotoğraf ızgarada,
   PDF belge listesinde çıkmalı.
9. Bir fatura ekinde "Faturadan doldur"a bas: alanlar forma dolmalı, sen
   kaydetmeden ekipman değişmemeli.
10. Üçüncü, hiçbir lokasyona üye olmayan kullanıcıyla gir: envanter boş;
   diğerinin ek dosyasının adresine gitmeyi dene — 404 dönmeli.

## 10. Sonraki sürümde eklenecek dağıtım adımları

- **E-posta bildirimi** (SMTP) — `ItemReminder` kanaldan bağımsız, şema
  değişmeden eklenir.

