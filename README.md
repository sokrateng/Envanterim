# Envanter Takip — başlangıç seti

Yeni projeye kopyalanacak dosyalar. GeziPay'de kurulup çalıştırılmış mimariden
türetildi, bu projenin gereksinimlerine göre yazıldı.

## Yerleşim

```
yeni-proje/
├── CLAUDE.md              ← bu klasördeki CLAUDE.md (ajan her oturumda okur)
└── docs/
    ├── MIMARI.md          ← veri modeli, yetki, dinamik alanlar, bildirim
    ├── TASARIM.md         ← iPhone 14 / Apple görünümü
    ├── URUN.md            ← benzer uygulamalar + öncelikli özellik listesi
    └── TUZAKLAR.md        ← bu yığında yaşanmış 30 hata ve çözümleri
```

Neden tek dosya değil: ajanın davranışını değiştiren şey bağlamda **sürekli
duran** kısa kurallardır. Uzun bir mimari yazısı bir kez okunur; `CLAUDE.md`
her oturumda yeniden yüklenir. Bu yüzden kural `CLAUDE.md`'de, gerekçe
`docs/`'ta durur.

## Açılış istemi

Dört dosyayı yeni depoya koyduktan sonra ilk mesaj olarak:

> Yeni bir proje kuruyoruz: **ev ve iş yerindeki elektronik ekipmanların
> envanterini takip eden bir web uygulaması.** Hedef cihaz iPhone 14, arayüz
> Türkçe, Apple görünümü.
>
> Mimariyi sıfırdan tasarlama. `CLAUDE.md`, `docs/MIMARI.md`, `docs/TASARIM.md`,
> `docs/URUN.md` ve `docs/TUZAKLAR.md` daha önce uçtan uca çalıştırılmış bir
> projeden çıkarıldı — beşini de oku ve aynı desenleri uygula. `TUZAKLAR.md`
> maddeleri gerçekten yaşanmış hatalardır; onlara tekrar düşme.
>
> `docs/MIMARI.md` §8'deki kurulum sırasını uygula ve bana çalışan bir iskelet
> ver: giriş, lokasyon oluşturma + üye davet etme, tek bir korumalı ekipman
> listesi, bir saf modül + testi, ve `DEPLOY.md`. Özelliklere sonra
> `docs/URUN.md` sırasıyla geçeceğiz.
>
> Faturadan veri çıkarma Claude API ile tek çağrıda yapılacak (`MIMARI.md` §6);
> ayrı bir OCR katmanı kurma. `ANTHROPIC_API_KEY` yalnız sunucuda kalsın.

## GeziPay'den doğrudan kopyalanabilecek kod

Prosa'dan iyisi çalışan kod. Şunlar projeden bağımsız, testleriyle birlikte taşınır:

| Dosya | Bu projede ne işe yarar |
|---|---|
| `src/lib/money.ts` | Alış tutarı, servis ücreti, yedek parça fiyatı (kuruş tabanlı) |
| `src/lib/storage.ts` | Fatura/fotoğraf yükleme — Supabase + yerel disk yedeği |
| `src/lib/image-client.ts` | Yüklemeden önce istemcide küçültme |
| `src/lib/access.ts` (desen) | `requireLocation` / `requireLocationEditor` şablonu |
| `src/lib/request-cache.ts` | İstek başına sorgu tekilleştirme |
| `src/lib/push.ts` + `push-message.ts` | Garanti bitimi web push bildirimi |
| `src/lib/history-state.ts` | Katman açıkken geri tuşu (tuzak #17-18) |
| `src/lib/zoom.ts` + `ImageViewer.tsx` | Fatura ve ürün fotoğrafını parmakla büyütme |
| `src/lib/swipe.ts` + `SwipeRow.tsx` | Liste satırında kaydırarak eylem |
| `DialogShell.tsx` + `useConfirm.tsx` | Onay diyaloğu / alttan açılan panel |
| `useUnsavedChanges.tsx` | Form doldururken çıkışta uyarı |
| `src/lib/hints.ts` + `Hint.tsx` | Görünmeyen özellikler için ilk kullanım ipucu |
| `src/lib/export-csv.ts` | Envanter dışa aktarma |
| `src/lib/receipt-review.ts` (desen) | Çıkarılan alanları kullanıcıya onaylatma adımı |
| `scripts/create-admin.ts` | İlk hesap |

Vitest testleri de repoda; **testleri birlikte taşı** — asıl değer onlarda.
