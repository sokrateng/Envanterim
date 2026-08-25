# CLAUDE.md — Envanter Takip

Bu dosyayı yeni projenin köküne koy. Claude Code her oturumda okur.

## Proje

Kişilerin ev ve iş yerlerindeki ekipmanlarını (bilgisayar, telefon, beyaz eşya,
araç…) takip ettiği envanter uygulaması. Satın alma, garanti, seri no, servis
kayıtları, yedek parça, belge ve fotoğraflar tek yerde. Garanti bitimi
yaklaşanlar için web push uyarısı.

**Kullanıcı arayüzü Türkçe. Hedef cihaz iPhone 14 (390×844).** Tasarım Apple
HIG'e yakın durmalı — ayrıntı `docs/TASARIM.md`.

## Yığın

Next.js 15 App Router · TypeScript · Tailwind · Prisma + PostgreSQL (Supabase) ·
NextAuth (credentials) · Vitest · Vercel · web-push (VAPID)

## Komutlar

```bash
npm run dev              # geliştirme
npm test                 # Vitest
npm run build            # prisma generate + next build
npm run db:migrate       # şema göçü (geliştirme)
npm run db:deploy        # şema göçü (üretim)
npm run create-admin     # ilk hesap
```

## Değişmez kurallar

- **Paylaşımın birimi lokasyon.** Her ekipman bir lokasyona bağlı; lokasyona
  kimin eri­şeceği `LocationMember` ile belirlenir. Yetki kontrolü **her zaman**
  lokasyon üyeliğinden geçer, kullanıcı kimliğinden değil.
- **Para tamsayı.** Tüm tutarlar kuruş cinsinden `Int`. Float para yok.
- **Tarihler tarih, metin değil.** Garanti/alış tarihi `DateTime`; karşılaştırma
  ve hatırlatma sorguları buna bağlı.
- **Sunucu bileşeni varsayılan.** `"use client"` yalnız form durumu, parmak
  hareketi ve tarayıcı API'si için.
- **Yetki sunucuda.** İstemciye giden veri zaten filtrelenmiş olmalı.
- **Zod ile doğrula.** Her API ucunun gövdesi şemadan geçer; hata mesajı Türkçe.
- **Saf mantık `src/lib/` içinde ve testli.** Garanti günü hesabı, amortisman,
  sahip olma maliyeti, dinamik alan doğrulaması — hepsi ayrı modül + test.
- **Dinamik alanlar çalışma anında doğrulanır.** Değerler `Item.customFields`
  (JSONB) içinde; tip güvenliğini veritabanı vermiyor, Zod şeması
  `CategoryField` tanımlarından üretilecek. Bu doğrulamayı atlama.
- **Faturadan çıkarılan veri kullanıcıya onaylatılır.** Claude'un döndürdüğü
  alanlar doğrudan kaydedilmez; forma doldurulur, kullanıcı görüp kaydeder.
  Fotoğraftan okuma hiçbir zaman %100 kesin değildir.
- **LLM çağrısı yalnız sunucuda.** `ANTHROPIC_API_KEY` asla `NEXT_PUBLIC_`
  olmaz. Model `claude-opus-5`; yapılandırılmış çıktı için `output_config.format`
  (eski `output_format` değil).
- **Sır istemciye sızmaz.** Supabase `service_role` yalnız sunucuda.
- **Yorum "neden"i anlatır.**

## Commit öncesi

`npx tsc --noEmit` · `npm test` · `npm run build` — üçü temiz olmadan commit yok.
Arayüz değişikliğini iPhone profilinde (390×844, dokunmatik) tarayıcıda gör.

## Yapma

- Şemaya `enum` koyma; sabitleri `src/lib/constants.ts`'te metin tut.
- Ekipmanı silme; `status = RETIRED/SOLD` ile yaşam döngüsünden çıkar. Servis
  ve maliyet geçmişi kaybolmamalı.
- Türetilmiş değeri saklama (toplam maliyet, kalan garanti günü) — hesapla.
- Sunucusuz fonksiyonda yanıttan sonra iş yapma; **çalışmaz**, bkz. TUZAKLAR #1.
- Tailwind sınıf adını dizgi birleştirerek üretme.
- Hover'a bağlı arayüz yapma — dokunmatikte hover yok.

## Belgeler

- `docs/MIMARI.md` — veri modeli, yetki deseni, dinamik alanlar, bildirimler
- `docs/TASARIM.md` — iOS görünümü: tipografi, renk, dokunma hedefi, güvenli alan
- `docs/URUN.md` — benzer uygulamalar ve öncelikli özellik listesi
- `docs/TUZAKLAR.md` — bu yığında yaşanmış somut hatalar
- `DEPLOY.md` — Vercel + Supabase kurulumu
