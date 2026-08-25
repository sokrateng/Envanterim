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

## 5. İlk hesap

Üretim veritabanına giriş yapacak kimse olmadan dağıtma:

```bash
DATABASE_URL="…üretim pooler…" npm run create-admin -- "Engin C" enginc "uzun-bir-sifre"
```

## 6. Duman testi (dağıtımdan sonra)

1. `/giris` → ilk hesapla gir.
2. Lokasyon oluştur → listede görünüyor mu?
3. Hesabı olan birini `+ Üye` ile ekle, rolünü `EDITOR` yap.
4. `+ Davet` ile kod üret; koddaki bağlantıyı gizli pencerede aç, hesap
   oluştur — kişi doğrudan o lokasyona verdiğin rolle üye olmalı. Aynı kodu
   ikinci kez kullanmayı dene: "Bu davet kodu kullanılmış" demeli.
5. `Envanter` sekmesinde ekipman ekle: ad + garanti bitiş tarihi.
6. Garanti rozeti doğru gün sayısını yazıyor mu?
7. İkinci kullanıcıyla gir: aynı ekipmanı görüyor, üye ekleyemiyor.
8. Üçüncü, hiçbir lokasyona üye olmayan kullanıcıyla gir: envanter boş.

## 7. Sonraki sürümde eklenecek dağıtım adımları

- **Storage bucket** (`faturalar`, `fotograflar`) + `SUPABASE_SERVICE_ROLE_KEY`
  — yükleme `apikey` başlığı da ister (docs/TUZAKLAR.md #5).
- **Vercel Cron** garanti uyarısı için günde bir; `ItemReminder.sentAt`
  damgası gönderimden **önce** yazılır (#28).
- **VAPID anahtarları** web push için.
- **`ANTHROPIC_API_KEY`** fatura okuma ucu için; route'ta
  `export const maxDuration = 60` (#32).
