# Uçtan uca testler

Playwright ile gerçek tarayıcıda, **iPhone 14 profilinde** (390×844, dokunmatik)
koşarlar. Birim testleri saf mantığı tutuyor (`src/lib/*.test.ts`); buradakiler
ekranın ve yetkinin gerçekten çalıştığını gösteriyor.

## Çalıştırma

```bash
npm run build && npm run start &   # sunucu ayakta olmalı
npm run seed:e2e                   # kullanıcı + lokasyon + bir ekipman
npm run test:e2e                   # dış servis istemeyenlerin hepsi
npm run test:e2e smoke zimmet      # seçilenler
```

Ortam değişkenleri: `E2E_BASE_URL` (varsayılan `http://localhost:3000`),
`E2E_USER`, `E2E_PASSWORD`, `E2E_SHOTS` (ekran görüntüsü dizini) ve
`E2E_CHROMIUM` (sistemdeki bir Chromium'u kullanmak için; boşsa Playwright'ın
kendi indirdiği tarayıcı).

Testler **kendi kayıtlarını açar** ve veriyi silmez: ekipman silinmiyor
(CLAUDE.md), kullanıcı ve lokasyon birikiyor. Geliştirme veritabanında sorun
değil; üretimde koşturma.

## Dış servis isteyenler

Bu dördü sahte sunucu ya da özel bayrak istiyor; `npm run test:e2e --hepsi`
demeden koşmazlar.

| Test | Gereken |
|---|---|
| `fatura`, `fatura-foto` | `node tests/e2e/sahte/mock-anthropic.mjs` (4999) ve sunucuyu `ANTHROPIC_API_KEY=deneme ANTHROPIC_BASE_URL=http://127.0.0.1:4999` ile başlat |
| `bildirim` | `node tests/e2e/sahte/mock-push.mjs` (TLS 5001), sunucuda VAPID anahtarları, sonra `node tests/e2e/sahte/push-hazirla.mjs` |
| `eposta` | `node tests/e2e/sahte/mock-smtp.mjs` (2525) ve sunucuda `SMTP_URL=smtp://127.0.0.1:2525 SMTP_FROM=...` |
| `tara`, `tara-barkod` | Önce `node tests/e2e/sahte/y4m.mjs qr "<ürün adresi>" /tmp/etiket.y4m`, sonra testi dosya yolu ve ürün kimliğiyle çağır |

Sahte servisler gerçek protokolü konuşuyor: mock-anthropic isteğin şeklini
(model kimliği, blok sırası, `output_config`) doğruluyor, mock-push VAPID
imzasını alıyor ve bir uçta `410 Gone` dönüyor, mock-smtp gelen postayı
`/tmp/mock-smtp.log`'a yazıyor.

## Yazarken

- **Dokunma kullan.** `page.tap`, `page.mouse.click` değil; hover'a bağlı hiçbir
  şey yok (CLAUDE.md) ve fare olayları kaydırma jestini tetiklemiyor
  (TUZAKLAR #45).
- **Metni `innerText` ile oku.** React bitişik metin düğümlerinin arasına
  `<!-- -->` koyuyor; `innerHTML` araması boşa düşüyor. Türkçe "İ" için de
  `toLowerCase()` kullanma (TUZAKLAR #41).
- **Ada göre seçme.** Aynı adlı iki üye olabiliyor; kimliğe bak, testte her
  koşuda ayrı ad üret (TUZAKLAR #46).
