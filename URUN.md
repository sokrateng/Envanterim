# Ürün — benzer uygulamalar ve özellik listesi

## Alandaki uygulamalar ve öğrenilecekleri

| Uygulama | Kime | İyi yaptığı |
|---|---|---|
| **Sortly** | Ev + küçük işletme | Fotoğraf öncelikli kart görünümü, klasör hiyerarşisi, **her ürüne QR etiket**, kategori bazlı özel alanlar |
| **Snipe-IT** (açık kaynak) | Şirket BT | Zimmet (kime verildi/geri alındı), lisans ve sarf malzeme ayrımı, bakım kayıtları, denetim izi |
| **EZOfficeInventory / AssetTiger** | Orta ölçek | Amortisman ve güncel değer, tekrarlayan bakım takvimi, barkod tarama |
| **Homebox** (açık kaynak, ev) | Ev | Garanti alanı, satın alma bilgisi, belge ekleri, etiketleme — bu projeye en yakın kapsam |
| **HomeZada / Encircle** | Ev sigortası | **Sigorta için toplam envanter değeri raporu** — hasar anında PDF çıktısı |
| **Grocy** | Ev | Pil değişimi ve periyodik görev takibi |

### Bu uygulamalarda olup sizin listenizde olmayan, eklemeye değer 6 şey

1. **QR etiket.** Her ürün için yazdırılabilir QR; cihazın üstüne yapıştırılır,
   telefonla okutunca ürün sayfası açılır. Fiziksel envanterde en çok işe yarayan
   özellik — seri no aramaktan kurtarır. *(Sortly ve Snipe-IT'in belkemiği.)*
2. **Sigorta / toplam değer raporu.** Tüm envanterin fotoğraflı PDF dökümü.
   Yangın, hırsızlık, sel durumunda sigortaya verilecek belge. Ev kullanıcısı
   için tek başına uygulamayı kurma sebebi olabilir.
3. **Sahip olma maliyeti.** Alış + servis + yedek parça toplamı. "Bu çamaşır
   makinesi bana bugüne kadar 18.400 ₺'ye mal oldu" — yenisini almaya karar
   verirken bakılan tek sayı. Veri zaten girilmiş oluyor, sadece toplamak gerekiyor.
4. **Yaşam döngüsü durumu.** Kullanımda / Serviste / Emekli / Satıldı. Silmek
   yerine durum değiştirmek geçmişi korur, raporu doğru tutar.
5. **Tekrarlayan bakım hatırlatması.** Garanti bitimi tek seferlik; oysa
   "6 ayda bir klima bakımı", "her 10.000 km'de servis" sürekli. Bildirim altyapısı
   zaten kurulmuş olacak, ikinci bir tür eklemek ucuz.
6. **Salt-okunur paylaşım linki.** Servise giderken teknisyene ürünün geçmişini
   hesap açtırmadan gösterme. Süreli, tek kullanımlık bir bağlantı.

### Değerlendirip elediklerim

- **Amortisman.** Şirket muhasebesi için değerli, ev kullanıcısı için gürültü.
  Alan olarak eklenebilir ama v1'de arayüz açmaya değmez.
- **Barkod/seri no kamera ile okuma.** `BarcodeDetector` API'si iOS Safari'de
  **yok**; `zxing-wasm` gibi bir kütüphane gerekir (~300 kB). QR etiket
  özelliğiyle birlikte tek seferde yapılmalı, ayrı ayrı değil.
- **Sarf malzeme stok takibi.** Yedek parçaya stok alanı koymak yeterli; ayrı
  bir stok modülü bu ürünün işi değil.

## Öncelikli özellik listesi

### v1 — çalışan iskelet
- [ ] Giriş (kullanıcı adı + şifre), ilk hesap betiği
- [ ] Lokasyon oluşturma, üye davet etme, rol verme (OWNER/EDITOR/VIEWER)
- [ ] Kategori tanımlama + kategoriye dinamik alan ekleme
- [ ] Ekipman ekleme/düzenleme: ad, marka, model, seri no, kategori, yer
- [ ] Satın alma: satıcı, tarih, tutar, garanti bitiş tarihi
- [ ] Fotoğraf ve belge ekleme (fatura, garanti belgesi, kılavuz)
- [ ] Liste + arama (seri no, marka, model) + kategori/durum filtresi
- [ ] Garanti durumu rozeti: kalan gün, bitmişse gri

### v2 — takip
- [ ] Servis kaydı (tarih, servis veren, yapılan iş, tutar)
- [ ] Yedek parça listesi ve temin ücretleri
- [ ] Ürün zaman çizelgesi — dört olay türü de: sayaç okuması, olay günlüğü,
      zimmet geçmişi, servis/maliyet
- [ ] **Faturadan otomatik doldurma** (Claude ile PDF + fotoğraf, tek çağrı;
      kullanıcı onaylayıp kaydeder)
- [ ] Web push: garanti bitimine 30 ve 7 gün kala
- [ ] Yaşam döngüsü durumu
- [ ] **QR etiket** üretme ve yazdırma

### v3 — rapor ve kolaylık
- [ ] Sahip olma maliyeti (ürün ve lokasyon bazında)
- [ ] Sigorta raporu: fotoğraflı PDF döküm + toplam değer
- [ ] CSV dışa/içe aktarma
- [ ] Tekrarlayan bakım hatırlatması (sayaç okumasına bağlanabilir:
      "her 10.000 km'de servis")
- [ ] **e-Arşiv/e-Fatura XML'inden ürün oluşturma** — modele hiç gitmeden,
      deterministik ve kesin
- [ ] Salt-okunur paylaşım linki

### Sonra
- [ ] E-posta bildirimi
- [ ] Barkod/QR kamera ile okuma
- [ ] Amortisman ve güncel değer

> **Not:** "Fotoğraftan OCR" ayrı bir madde değil — Claude fotoğrafı ve PDF'i
> doğrudan okuduğu için v2'deki tek maddeyle geliyor. Tesseract benzeri bir OCR
> katmanı kurulmayacak.

## Ölçüt

v1 bittiğinde şu cümle doğru olmalı: *"Telefonumdan bir ekipman ekleyebiliyorum,
faturasını yükleyebiliyorum, garantisinin ne zaman biteceğini görebiliyorum ve
eşim de aynı listeye girip düzenleyebiliyor."* Bundan fazlasını v1'e sokma.
