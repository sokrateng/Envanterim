# Tasarım — iPhone 14 / Apple görünümü

Hedef cihaz iPhone 14: **390×844 CSS px**, üstte çentik, altta ana ekran
göstergesi. Web uygulaması ama iOS'a ait hissettirmeli.

## Tipografi

**Yazı tipi indirme.** iOS'ta gerçek SF Pro'yu sistem yığınıyla alırsın:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui,
             "Segoe UI", Roboto, sans-serif;
```

SF Pro'yu web fontu olarak dağıtmak lisansa aykırı; zaten gerek yok. Android ve
masaüstünde yığın kendi sistem fontuna düşer, görünüm yerel kalır.

Ölçek (iOS Text Styles karşılıkları):

| Kullanım | Boyut / kalınlık |
|---|---|
| Large Title (ekran başlığı) | 34px / 700 |
| Title | 22px / 700 |
| Headline (liste satırı başlığı) | 17px / 600 |
| Body | 17px / 400 |
| Subheadline | 15px / 400 |
| Footnote (ikincil bilgi) | 13px / 400 |
| Caption | 12px / 400 |

**Gövde metnini 17px'in altına indirme.** iOS'ta girdi alanı 16px'in altındaysa
Safari odaklanınca sayfayı yakınlaştırır ve geri çıkmaz.

## Renk

iOS sistem renkleri — açık/koyu tema karşılıklarıyla:

| Ad | Açık | Koyu |
|---|---|---|
| Blue (birincil eylem) | `#007AFF` | `#0A84FF` |
| Green (olumlu) | `#34C759` | `#30D158` |
| Red (yıkıcı) | `#FF3B30` | `#FF453A` |
| Orange (uyarı) | `#FF9500` | `#FF9F0A` |
| Zemin | `#F2F2F7` | `#000000` |
| Kart / yüzey | `#FFFFFF` | `#1C1C1E` |
| Ayraç | `#C6C6C8` | `#38383A` |
| İkincil metin | `#8E8E93` | `#8E8E93` |

Tümünü CSS değişkeni olarak tanımla, Tailwind'e token olarak bağla; koyu tema
`prefers-color-scheme` ile açılsın.

## Düzen desenleri

**Gruplanmış liste (Inset Grouped).** iOS ayarlar ekranının o kart görünümü —
bu uygulamanın ana deseni:
- Kart: `border-radius: 10px`, yatayda 16px kenar boşluğu
- Satırlar arası ayraç **soldan 16px içeriden** başlar, karta kadar gitmez
- Grup başlığı: küçük, büyük harf, gri, kartın üstünde

**Alt sekme çubuğu.** 4–5 sekme, ikon + etiket. Güvenli alanı hesaba kat:

```css
padding-bottom: env(safe-area-inset-bottom);
```

Bunu atlarsan çubuk ana ekran göstergesinin altında kalır.

**Alt sayfa (sheet).** Yeni kayıt ve düzenleme için tam sayfa yerine alttan
açılan panel: üst köşeler yuvarlak (16px), tepede tutamak çubuğu, arkada
karartma. GeziPay'deki `DialogShell` bu desenin küçük hâli, doğrudan taşınabilir.

**Segmented control.** Filtre için açılır menü yerine: "Tümü / Kullanımda /
Serviste / Emekli". Tek dokunuşla değişir.

**Kaydırarak eylem.** Liste satırında sağa/sola kaydırma — GeziPay'deki
`SwipeRow` doğrudan taşınabilir. Envanterde: sola → Düzenle · Sil,
sağa → Serviste işaretle.

## Dokunma kuralları

- **Dokunma hedefi en az 44×44 px.** Küçük ikon düğmelerine görünmez dolgu ver.
- `-webkit-tap-highlight-color: transparent` — gri kutu parlamasını kaldır.
- Basılı hissi `active:scale-95` gibi küçük bir ölçekle verilir.
- **Hover'a bağlı hiçbir şey olmasın.** Dokunmatikte hover yok; ipucu, menü,
  buton hepsi dokunuşla erişilebilir olmalı.
- `touch-action` bilinçli ayarlanır: dikey kaydırmayı tarayıcıya bırak
  (`pan-y`), yatay hareketi kendin ele al.
- **Titreşim yok.** `navigator.vibrate` iOS Safari'de çalışmaz; haptik geri
  bildirime güvenme.

## Güvenli alanlar

```css
/* viewport-fit=cover meta etiketi şart, yoksa env() sıfır döner */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

Sabit üst başlık ve alt çubuk bunları hesaba katmalı. Yatay çevrildiğinde
`safe-area-inset-left/right` de devreye girer.

## PWA

- `display: standalone` — ana ekrandan tam ekran açılır
- `apple-mobile-web-app-status-bar-style` ile durum çubuğu rengi
- İkon: 180×180 `apple-touch-icon`
- **Dikkat:** `standalone` iOS'ta sayfa yakınlaştırmasını kapatır. Ürün
  fotoğrafını ve fatura görüntüsünü parmakla büyütmek gerekiyorsa yakınlaştırmayı
  kendin yazmalısın (TUZAKLAR #8, GeziPay'deki `zoom.ts` + `ImageViewer` hazır).

## Hareket

Geçişler 200–300ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`. Uzun ve gösterişli
animasyon iOS'ta yabancı durur. `prefers-reduced-motion` açıksa süreleri sıfırla.

## Kaydırma jesti

Liste satırında sola kaydırınca işlem düğmeleri çıkar (`src/components/SwipeRow.tsx`,
matematiği `src/lib/swipe.ts`). Üç kural:

- **Jest dikey kaydırmayı çalmaz.** Yön ilk 8 pikselde bir kez seçilir ve jest
  bitene kadar değişmez; eşitlikte dikey kazanır. Sürüklenen yüzeyde
  `touch-action: pan-y` durur (TUZAKLAR #45).
- **Kısayol, tek yol değildir.** Kaydırmadan çıkan her işlem ekipman
  sayfasında da var; jesti bilmeyen hiçbir şey kaybetmez. Düğmeler kapalıyken
  `tabindex="-1"`, açıkken erişilebilir.
- **Yıkıcı işlem tek dokunuşta bitmez.** Silme hemen gitmez: satır listeden
  kalkar, "Geri al" şeridi çıkar, süre dolunca istek gider. Sayfadan çıkılırsa
  istek hiç gitmez — yanlış yön kayıp değildir.

Parmak kalkınca satır yarı yolda kalmaz: mesafe panelin %40'ını geçtiyse ya da
fiske hızlıysa açık kalır, değilse kapanır.

## Kod okuma ekranı

- **Okuma penceresi çözümlemenin baktığı yerle aynı.** Süs çerçeve çizip tüm
  kareyi çözümlemek kullanıcıyı yanıltıyor: "çerçeveye aldım, neden okumadı?"
- **Kırmızı tarama çizgisi** okumaya çalışıldığını anlatıyor. Hareket
  `prefers-reduced-motion` açıkken duruyor, çizgi kalıyor.
- **Yakınlaştırma dokunma hedefi kadar düğmelerle** (1×–4×), kaydırıcıyla değil:
  tek elle, bakmadan basılabiliyor.
- **Işık düğmesi yalnız cihaz destekliyorsa.** iPhone'da görünmüyor (TUZAKLAR
  #59); orada kullanıcıya ışığı ortamdan alması söyleniyor.

## Liste ve detay

- **Satırın solunda ürün fotoğrafı** (44px), yoksa kategori simgesi. Fotoğrafsız
  satır da aynı yeri kaplıyor: liste hizası bozulmuyor.
- **Filtreler tek düğmenin arkasında.** Dört çip sırası 390 pikselde ekranın
  yarısını yiyordu. Düğmedeki sayı kaç filtrenin açık olduğunu söylüyor; açık
  filtreler listenin üstünde tek satırda, dokununca kalkıyor.
- **Ad alanı sabit yükseklikte** (82px), punto ada göre küçülüyor
  (`src/lib/typography.ts`). Uzun adlar sayfayı aşağı itmiyor.
- **Durum tek satır**, seçenekler panelde: yılda bir iki kez değişen bir şey
  için dört satır ayırmıyoruz.

## Onay kutusu

Tarayıcının `confirm()` kutusu kullanılmıyor: masaüstü görünümlü, adres
çubuğuna yapışık ve biçimlendirilemiyor. Yerine `ConfirmDialog` — ortada, iki
düğmeli, yıkıcı olan kırmızı, dışına dokunmak "vazgeç".

Veri girilen paneller `guardUnsaved` ile açılıyor: bir alana dokunulmuşsa ✕,
Esc, boşluğa dokunma ve donanım "geri"si önce soruyor. Geri tuşundan gelen
istek iptal edilirse panelin geçmiş kaydı geri konuyor, yoksa ikinci geri tuşu
sayfayı kapatırdı.

