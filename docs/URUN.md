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
4. **Yaşam döngüsü durumu.** Kullanımda / Serviste / Pasif / Satıldı. Silmek
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
- [x] Giriş (kullanıcı adı + şifre), ilk hesap betiği
- [x] Lokasyon oluşturma, üye davet etme, rol verme (OWNER/EDITOR/VIEWER)
- [x] Kategori tanımlama + kategoriye dinamik alan ekleme
- [x] Ekipman ekleme/düzenleme: ad, marka, model, seri no, kategori, yer
- [x] Satın alma: satıcı, tarih, tutar, garanti bitiş tarihi
- [x] Fotoğraf ve belge ekleme (fatura, garanti belgesi, kılavuz)
- [x] Liste + arama (seri no, marka, model) + kategori/durum filtresi
- [x] Garanti durumu rozeti: kalan gün, bitmişse gri

### v2 — takip
- [x] Servis kaydı (tarih, servis veren, yapılan iş, tutar)
- [x] Yedek parça listesi ve temin ücretleri
- [x] Ürün zaman çizelgesi — dört olay türü de: sayaç okuması, olay günlüğü,
      zimmet geçmişi, servis/maliyet
- [x] **Faturadan otomatik doldurma** (Claude ile PDF + fotoğraf, tek çağrı;
      kullanıcı onaylayıp kaydeder)
- [x] Web push: garanti bitimine 30 ve 7 gün kala
- [x] Yaşam döngüsü durumu
- [x] **QR etiket** üretme ve yazdırma

### v3 — rapor ve kolaylık
- [x] Sahip olma maliyeti (ürün ve lokasyon bazında)
- [x] Sigorta raporu: fotoğraflı PDF döküm + toplam değer
- [x] CSV dışa/içe aktarma
- [x] Tekrarlayan bakım hatırlatması (sayaç okumasına bağlanabilir:
      "her 10.000 km'de servis")
- [x] **e-Arşiv/e-Fatura XML'inden ürün oluşturma** — modele hiç gitmeden,
      deterministik ve kesin
- [x] Salt-okunur paylaşım linki

### v4 — sorumluluk ve yapı
- [x] **Zimmet (teslim–tesellüm).** Ekipman bir kişiye zimmetlenir; kişi
      "üzerime al" diyene kadar teslim sayılmaz, almayanlar raporlanır.
      Sorumlu ya lokasyon üyesi ya da hesabı olmayan biri olabilir; ikincisinde
      teslimi sahibi onun adına işaretler ve bu iz kayda geçer.
- [x] Zimmet devri (kişiden kişiye), iade ve red
- [x] Zimmet bildirimi: atanan kişiye push + e-posta, cevabı atayana
- [x] **Alt ekipman.** Lisans, hoparlör, klavye… ana ekipmana bağlanır;
      zimmet ve devir birlikte işler, maliyet "bileşenlerle birlikte" görünür.
- [x] Kaydırma jestleri: envanter satırında hızlı işlem, zaman çizelgesinde
      geri alınabilir silme

### v5 — olgunluk
- [x] Uçtan uca testler repoda, tek komutla koşuyor
- [x] Şifre değiştirme ve e-postayla şifre sıfırlama
- [x] Lokasyon adı/ikonu düzenleme; boş lokasyonu kapatma
- [x] Envanter listesinde sayfalama (süzme veritabanında)
- [x] Çevrimdışı okuma (service worker); çıkışta önbellek temizleniyor
- [x] JSON yedek ve denetim izi ("Hareketler")

### Sonra
- [x] E-posta bildirimi
- [x] Barkod/QR kamera ile okuma
- [ ] Amortisman ve güncel değer

> **Not:** "Fotoğraftan OCR" ayrı bir madde değil — Claude fotoğrafı ve PDF'i
> doğrudan okuduğu için v2'deki tek maddeyle geliyor. Tesseract benzeri bir OCR
> katmanı kurulmayacak.

## Ölçüt

v1 bittiğinde şu cümle doğru olmalı: *"Telefonumdan bir ekipman ekleyebiliyorum,
faturasını yükleyebiliyorum, garantisinin ne zaman biteceğini görebiliyorum ve
eşim de aynı listeye girip düzenleyebiliyor."* Bundan fazlasını v1'e sokma.
