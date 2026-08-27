# Tuzaklar

Hepsi bu yığında (Next.js + Vercel + Supabase + Prisma, iOS PWA) **gerçekten
yaşandı**. Her biri saatlerce zaman aldı; ajana önceden vermek en çok burada
kazandırır.

## Sunucusuz (Vercel)

**1. Yanıttan sonra iş yapma — çalışmaz.**
Fonksiyon yanıtı döndükten sonra dondurulur. "Yanıtı hemen dön, bildirimi arkadan
gönder" deseni sessizce hiçbir şey göndermez. Hata da vermez, bu yüzden fark
etmesi zor. **Çözüm:** işi `await` et. Gecikme kabul edilemezse gerçek bir kuyruk
kullan, `setTimeout` değil.

**2. Açık dev sunucusu varken `npm run build` çalıştırma.**
İkisi de `.next` dizinine yazar; dev sunucusu `Cannot find module './8948.js'`
diye çöker. **Çözüm:** dev'i durdur ya da başka portta yeniden başlat.

## Prisma + Supabase

**3. Göç için `directUrl` şart.** Havuzlanmış bağlantı (6543) üzerinden şema
göçü yapılamaz. `datasource`'a `directUrl` eklenmezse `migrate` takılır.

**4. Verisi olan veritabanına göç geçmişi eklemek.**
Şema `db push` ile kurulmuşsa `migrate` geçmişi yoktur ve ilk `migrate dev`
"veritabanını sıfırlayayım mı" der. **Çözüm — veri kaybetmeden temel alma:**
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init     # mevcut veritabanında
```

**5. Storage'a yükleme `apikey` başlığı ister.** Yalnız `Authorization: Bearer`
yetmiyor; Supabase ayrıca `apikey` bekliyor. Eksikse 401 döner.

**6. Ücretsiz proje bir hafta sonra duraklar.** Uygulama birden veritabanına
ulaşamaz. Panelden uyandırmak gerekir.

**7. Tabloyu üretimde unutmak.** `db push` yerelde çalışıp üretimde
çalıştırılmazsa `P2021: table does not exist` gelir. Göç adımını dağıtım
kılavuzuna yaz.

## iOS / mobil

**8. `maximum-scale=1` parmakla yakınlaştırmayı tüm uygulamada öldürür.**
Üstüne manifest `display: standalone` ise iOS sayfa yakınlaştırmasını zaten
tamamen kapatır. **Çözüm:** görsel büyütmeyi kendin yaz (pointer olayları +
`touch-action: none` + transform). Viewport'u gevşetmek ana ekrandan açılan
uygulamada işe yaramaz.

**9. `window.Notification` sekmede tanımsız olabilir.** iOS Safari'de bildirim
desteğini `"Notification" in window` ile kontrol et; doğrudan erişim patlar.

**10. Izgara çocuğu taşar.** `grid` içindeki öğelerin varsayılanı
`min-width: auto`; `type="date"` girdisi kutusundan taşar. **Çözüm:**
`min-width: 0` + `-webkit-appearance: none`.

**11. WhatsApp'a `wa.me` ile metin göndermek mobilde içeriği kaybettiriyor.**
**Çözüm:** `navigator.share` (Web Share API) kullan, `wa.me`'yi yedek bırak.

**12. iOS kenar-geri hareketi.** Ekranın sol kenarından başlayan sağa kaydırma
tarayıcının "geri"si. Satır kaydırma gibi özellikler kenardan ~20px içeride
başlamalı; kullanıcıya da öyle anlat.

## Tarayıcı / CSS

**13. `max-h-*` çocuğu kırpmaz.** Uzun bir görsel kutusundan taşar.
**Çözüm:** `overflow-hidden` ekle ya da sabit yükseklik ver.

**14. Tailwind dinamik sınıf adı göremez.** `` `${yon}-0` `` üretilen sınıfı
JIT taramada bulamaz, stil hiç yazılmaz. **Çözüm:** tam adı koşullu yaz
(`yon === "left" ? "left-0" : "right-0"`).

**15. `Math.min/max` sıfırın işaretini korur.** `-0` sızar; CSS'i bozmaz ama
`=== 0` karşılaştırmalarını şaşırtır. **Çözüm:** `|| 0` ile normalize et.
(Bu projede iki ayrı modülde aynı hata çıktı.)

**16. Arka katman + içindeki düğme, aynı dokunuşta iki kez tetiklenir.**
Kapatma "geçmişte bir adım geri" gibi bir yan etkiliyse iki adım geri gidilir.
**Çözüm:** işlemi bir kez çalışacak şekilde koru (`ref` bayrağı) ya da
`stopPropagation`.

## Geri tuşu ve katmanlar

**17. Tam ekran katman geçmişe kayıt bırakmazsa geri tuşu sayfadan atar.**
Kullanıcı fişi büyütüp geri basınca listeye düşer. **Çözüm:** katman açılırken
`history.pushState`, `popstate`'te kapat. Kapatmanın tüm yolları (✕, Esc,
boşluk) aynı kanaldan geçsin ki eklenen kayıt her durumda temizlensin.

**18. İki ayrı özellik aynı `popstate`'i dinlerse birbirine karışır.**
Katman kapanırken "kaydedilmemiş değişiklik var" uyarısı da tetiklenir.
**Çözüm:** `history.pushState` ile konan kayıtları işaretle ve dinleyiciler
"bu geri hareketi bana mı ait?" sorusunu **düşülen kaydın işaretinden** yanıtlasın
— dinleyici kayıt sırasına güvenme.

**19. Hareket sırasında düzen kaydırma.** Kaydırınca kapanan bir ipucu, listeyi
parmağın altında yukarı çeker; kullanıcının az önce açtığı düğmeler kaçar.
**Çözüm:** düzeni değiştiren kapanışı hareket bittikten sonraya al.

## next/og (paylaşım görseli)

**20. Satori yalnız flexbox anlar.** `display: flex` açıkça yazılmalı, `grid`
yok, emoji tofu olarak çıkar.

**21. Yazı tipi gömülmezse kalın yazı ve `₺` çıkmaz.** Node çalışma zamanında
`fetch(new URL('./font.ttf', import.meta.url))` `ERR_INVALID_URL` verir.
**Çözüm:** `fs.readFileSync(path.join(process.cwd(), ...))` + `next.config.mjs`
içinde `outputFileTracingIncludes` ile dosyayı pakete dahil et.

## Test etme

**22. Ölçümü hareket eden öğeden alma.** Kaydırılan satırın kendi kutusu ekran
dışına çıkar; sabit duran kapsayıcıdan ölç.

**23. Dokunuş simülasyonu ekran içinde kalmalı.** Ekran genişliğini aşan
koordinatlara giden hareketler sessizce düşer.

**24. `beforeunload` diyaloğunu ayırt et.** Testte tüm diyalogları kapatan bir
dinleyici, sayfadan çıkışı da iptal eder ve `page.goto` başarısız olur.
`dialog.type()` ile ayır.

## Bu projeye özgü olması muhtemel olanlar

**25. JSONB alanına doğrudan güvenme.** `Item.customFields` veritabanı tarafında
tip zorlaması yapmaz; `CategoryField` tanımı değişince eski kayıtlarda eski
anahtarlar kalır. Okurken eksik/fazla anahtara dayanıklı ol, yazarken çalışma
anında üretilen Zod şemasından geçir.

**26. Kategori alanı silinince veri öksüz kalır.** Tanımı silmek değeri
silmiyor. Ya değerleri de temizle ya da tanımı "gizli" işaretle — sessizce
görünmez veri bırakma.

**27. Tarih karşılaştırmasında saat dilimi.** Garanti "bugün bitti mi" sorusu
UTC ile yerel gün sınırı arasında kayar. Tarihleri günün başına normalize et,
karşılaştırmayı tek yerde yap ve test yaz.

**28. Cron iki kez tetiklenebilir.** Vercel Cron aynı işi yeniden çalıştırabilir;
gönderilen bildirimi damgalamazsan kullanıcı aynı uyarıyı iki kez alır.
`sentAt` kontrolünü gönderimden **önce** yaz.

**29. Push aboneliği sessizce ölür.** Kullanıcı bildirimi kapatınca ya da
tarayıcı aboneliği yenileyince eski kayıt `410 Gone` döner. Bu yanıtı yakala ve
aboneliği sil, yoksa her turda başarısız gönderim biriktirir.

**30. Fatura PDF'i görsel değil.** Fotoğraf boru hattı (istemcide küçültme,
`<img>` ile gösterme) PDF'te çalışmaz. `Attachment.kind` ayrımını baştan yap ve
PDF'i ayrı ele al.

## Faturadan veri çıkarma (Claude API)

**31. Vercel istek gövdesi ~4,5 MB.** Telefon fotoğrafı rahatça aşar; route
handler'a doğrudan yüklemek 413 verir. Dosyayı önce Supabase Storage'a yükle,
sunucu oradan okusun. İstemcide küçültme yine de ilk savunma.

**32. Fonksiyon süresi varsayılanı yetmez.** Çıkarma çağrısı saniyeler sürer.
Route'ta `export const maxDuration = 60` ayarla ve planının üst sınırını
doğrula — ayarlamazsan istek yarıda kesilir.

**33. Belge bloğu metin bloğundan önce gelmeli.** `content` dizisinde
`document`/`image` bloğu `text` bloğundan sonra konursa sonuç belirgin şekilde
kötüleşir.

**34. `output_format` kullanımdan kalktı.** Yapılandırılmış çıktı
`output_config: { format: {...} }` ile verilir. Eski adı hatırlayıp yazma.

**35. Alıntılar (`citations`) ile yapılandırılmış çıktı birlikte çalışmaz.**
İkisini aynı istekte kullanmak 400 döner.

**36. Çıkarılan veriyi doğrudan kaydetme.** Yapılandırılmış çıktı JSON'un
*şeklini* garanti eder, *doğruluğunu* değil. Model tarihi yanlış okuyabilir,
seri no ile model kodunu karıştırabilir. Forma doldur, kullanıcı onaylasın.

**37. Anahtarı ve maliyeti koru.** Yükleme ucu kimlik doğrulamalı olmalı ve
kullanıcı başına hız sınırı taşımalı; yoksa açık bir uç faturayı şişirir.

## Next.js 15 App Router (bu projede yaşandı)

**38. `node:` şemalı içe aktarma istemci paketini kırar.** Sunucu için yazılmış
bir yardımcı modül (`node:crypto`) bir istemci bileşeni tarafından da içe
aktarılınca webpack `UnhandledSchemeError: Reading from "node:crypto" is not
handled by plugins` diyor ve sayfa 500 dönüyor. Modülün kendisi masum;
sorun paylaşılıyor olması. **Çözüm:** iki tarafın da kullandığı modülde Web
Crypto (`crypto.getRandomValues`) gibi izomorfik API kullan; sunucuya özel
şeyi ayrı dosyada tut. Rastgele değeri alfabeye indirirken kalanla eşleme
sapma yaratır (`256 % 31 ≠ 0`) — sınırın üstündeki baytı at.

**39. Efektin bağımlılığı her render'da kimliği değişen bir işlev olmasın.**
Panel açıkken gelen bir `router.refresh()` bileşeni yeniden çizince, `onClose`
gibi gövdede tanımlanmış bir işlev yeni kimlik alıyor; efekt sökülüp yeniden
kuruluyor ve sökme sırasındaki `history.back()` paneli **kendiliğinden
kapatıyor**. Kullanıcı formu kaydediyor, panel bir anda kayboluyor. Bu,
TUZAKLAR #18'deki karışmanın React tarafındaki hâli. **Çözüm:** en güncel
geri çağrıyı bir `ref`te tut, efekti yalnız `[open, id]`ye bağla.

**40. Panel kapanırken yapılan `router.refresh()` etkisiz kalır.** Katman
`history.back()` ile kapanıyor; yönlendirici o geçmiş kaydını **kendi eski RSC
anlık görüntüsüyle** geri kuruyor ve kapanıştan önce istenen yenilemeyi
siliyor. Yeni kaydedilen kayıt listede görünmüyor, kullanıcı "kaydedilmedi"
sanıyor. Kendi `pushState`'inde yönlendiricinin durumunu koruman da yetmiyor.
**Çözüm:** sırayı tersine çevir — önce kaydı temizle, yenilemeyi `popstate`
sonrasına al:

```ts
const finish = () => { window.removeEventListener("popstate", finish); router.refresh(); };
window.addEventListener("popstate", finish);
close();                       // efekt temizliği history.back() çağırır
```

Kayıt bir şekilde yoksa `popstate` hiç gelmez; kısa bir zamanlayıcıyı yedek bırak.

## Türkçe metin

**41. `toLowerCase()` Türkçe "İ"yi bozar.** `"DEĞERİ".toLowerCase()` "değeri"
vermiyor: nokta ayrı bir birleştirici karaktere dönüşüyor (`i` + U+0307) ve
dizgi karşılaştırması sessizce şaşıyor. `toLocaleLowerCase("tr")` ise bu kez
`I`yı `ı` yapıyor — İngilizce yazılmış başlıklarla eşleşme kayboluyor.
**Çözüm:** karşılaştırmayı harf eşlemesiyle normalleştir (bkz.
`src/lib/csv.ts` → `normalizeHeader`), ya da özgün yazımın durduğu yerde
(HTML, veritabanı değeri) karşılaştır. CSS `text-transform: uppercase`
metnin kendisini değiştirmediği için `innerText` ile okurken bu tuzağa ayrıca
dikkat et.

## Kamerayla kod okuma

**42. `zxing-wasm` .wasm dosyasını varsayılan olarak jsDelivr'dan çeker.**
Kütüphanenin `locateFile`'ı CDN'e bakıyor; dosyayı kendin sunmazsan tarayıcı
ekranı dış bir alan adına bağımlı hâle geliyor — çevrimdışı açılmıyor, sıkı
bir CSP'de hiç yüklenmiyor ve okutma sessizce "kamera açık ama hiç okumuyor"
gibi görünüyor. **Çözüm:** `.wasm`'i `public/` altına kopyala
(`scripts/copy-zxing.mjs`, kuruluma ve derlemeye bağlı) ve
`prepareZXingModule({ overrides: { locateFile } })` ile kendi yolunu ver. Testte
dış CDN'e istek gitmediğini de doğrula.

**43. Tarama açıkken elle yazılan koda fırsat kalmıyor.** Kamera arkada
okumaya devam ederken kullanıcı seri numarasını yazıyor; çerçeveye giren
başka bir etiket okunuyor ve ekran bambaşka bir ürüne atlıyor. Yazdığı şey
kayboluyor. **Çözüm:** metin alanına odaklanınca (ya da içinde metin varken)
çözümlemeyi duraklat ve bunu ekranda söyle; akış kullanıcının seçtiği yerden
devam etsin.

**44. Chromium'un sahte kamerası yalnız `.y4m` ve `.mjpeg` okur.** Playwright
ile okutmayı test etmek için `--use-file-for-fake-video-capture` gerekiyor ama
elde PNG var; ortamdaki ffmpeg derlemesi de PNG çözemeyebiliyor. **Çözüm:**
y4m'yi kendin yaz — başlık artı kare başına `FRAME\n` ve Y/U/V düzlemleri;
QR modüllerini doğrudan Y düzlemine çiz. Böylece testin ffmpeg'e bağımlılığı
kalmıyor.

## Kaydırma jesti

**45. Yatay jest dikey kaydırmayı çalar.** Satıra `pointermove` bağlayıp her
harekette satırı kaydırınca liste dikeyde kilitleniyor: parmak biraz yana
kaçtığı için uzun envanterde sayfa kaymıyor. `preventDefault` da çare değil —
`touchmove` pasif dinleyicide. **Çözüm:** yönü ilk birkaç pikselde **bir kez**
seç ve jest bitene kadar değiştirme; eşitlikte dikeyi seç; sürüklenen yüzeye
`touch-action: pan-y` ver. Testi fare ile yapamazsın: Playwright'ta
`Input.dispatchTouchEvent` ile gerçek parmak hareketi gönder, hem yatayı hem
dikeyi doğrula.

**46. Ad kimlik değildir.** Aynı lokasyonda "Eylül Çoban" adlı iki üye
olabiliyor (test koşuları, isim benzerliği). Ada göre seçen her kod — arayüzde
`selectOption({ label })`, raporda ada göre gruplama, "kim üzerine aldı"
karşılaştırması — sessizce yanlış kişiyi buluyor ve hata "yetki çalışmıyor"
gibi görünüyor. **Çözüm:** üye tarafında her yerde kimliğe bak; ad yalnız
hesabı olmayan kişide veri. Testte de her koşuda ayrı ad üret.

## Çevrimdışı

**47. `context.setOffline` service worker'ın isteğini kesmiyor.** Playwright ile
çevrimdışı davranışını test ederken sayfa `fetch`'i başarısız oluyor ama
service worker'ın kendi `fetch`'i sunucuya ulaşıyor: test yeşil yanıyor, oysa
hiçbir şey önbellekten gelmiyor. Ayırt etmesi zor, çünkü sonuç doğru görünüyor.
**Çözüm:** ağı `context.route("**/*", (r) => r.abort())` ile kes; yönlendirme
service worker isteklerini de kapsıyor. Bir kontrol daha: yanıtın gerçekten
önbellekten geldiğini `caches.keys()` ile doğrula.

**48. App Router'da yalnız HTML önbelleğe alınırsa uygulama içi gezinme
çevrimdışı çalışmaz.** Kullanıcı bağlantıya dokununca tarayıcı belge değil
**RSC yükü** çekiyor (`?_rsc=…`); service worker yalnız `mode === "navigate"`
isteklerini saklıyorsa bu yük önbellekte olmuyor ve ağsızken tıklamalar boşa
düşüyor — üstelik sayfayı elle yenileyince açıldığı için "çalışıyor" sanılıyor.
**Çözüm:** RSC isteklerini de sakla; anahtar `_rsc` parametresi yönlendirici
durumunu kodladığı için adres başına ayrı kayıt oluyor.

## Performans

**49. Grup düzeyinde `loading.tsx`, panelden dönen `router.refresh()`'i yutuyor.**
İskelet ekranı eklemek gezinmeyi hızlı hissettiriyor ama (uygulama) grubuna
konan `loading.tsx` bir Suspense sınırı açıyor ve panel `history.back()` ile
kapanırken yapılan yenilemeyi eziyor: kullanıcı kaydediyor, panel kapanıyor,
**yeni kayıt listede görünmüyor** — TUZAKLAR #40'ın geri gelmiş hâli. Yenilemeyi
bir sonraki makro göreve ertelemek de çözmüyor. **Çözüm:** panel barındıran
ekranlarda grup düzeyinde `loading.tsx` kullanma. Algılanan hızı bağlantı ön
yüklemesi ve sorguları paralelleştirerek kazan.

**50. Sunucu bileşeninde sıralı sorgular sessiz bir şelale.** Sayfa yavaşsa
suçlu genelde tek bir ağır sorgu değil, arka arkaya beklenen altı küçük sorgu:
uygulama ile veritabanı ayrı bölgelerdeyse her biri ayrı bir gidiş-dönüş.
Yerelde fark edilmiyor (aynı makine, ~1 ms), üretimde altı tur × 100 ms oluyor.
**Çözüm:** birbirine bağlı olmayanları `Promise.all` ile, aynı tabloya giden
sayım + listeyi `$transaction([...])` ile tek tura indir; bir de uygulamayı
veritabanıyla aynı bölgeye al (`vercel.json` → `regions`).

## Yapılandırma

**51. Bozuk bir ayar, alakasız bir özelliği düşürüyor.** `VAPID_SUBJECT`
"Envanter_Test_Mail_Subject" yazılmıştı; web-push bunu doğrulayıp hata
fırlatıyor ve hata **zimmet verme** ucundan dönüyor — üstelik kayıt yazıldıktan
sonra, yani kullanıcı hata görüyor ama zimmet oluşmuş oluyor. **Çözüm iki
katmanlı:** (1) ayar okunurken biçim doğrulanıp özellik **kapalı** bırakılıyor,
patlamıyor; (2) bildirim gönderimi hiçbir koşulda çağıran işi düşürmüyor —
bildirim yan iş, kayıt asıl iş. Genel kural: yan işler sessiz başarısız olur,
asıl iş kullanıcıya döner.

**52. `VAPID_SUBJECT` bir adres, etiket değil.** `mailto:sen@ornek.com` ya da
`https://alan-adin`. Bildirimin kimden geldiğini push servisine söyleyen alan;
konu başlığı sanıp metin yazmak kolay (`.env.example`'da örnek var).

## İkinci LLM sağlayıcısı

**53. `response.output[0]` metin değil.** OpenAI Responses API'sinde akıl yürüten
dağıtımlar diziye önce bir `reasoning` bloğu koyuyor; ilk elemanı okuyan kod
(Azure örneklerindeki `print(response.output[0])` dahil) boş ya da anlamsız
sonuç veriyor. Doğrusu: `type === "message"` olan blokları süzüp içlerindeki
`output_text` parçalarını birleştirmek. Metin boş çıktıysa sebebi de yanıtta
duruyor — `incomplete_details.reason === "max_output_tokens"` demek "akıl
yürütme bütçeyi yedi, sınırı artır" demek; "model çalışmıyor" değil.

**54. Azure'da model adı değil dağıtım adı çağrılıyor.** `model` alanına
`gpt-5.6` yazmak 404 veriyor; kaynağa açtığın dağıtımın adı (`gpt-5.6-sol`)
yazılmalı. Uç adresi de `/openai/v1` ile bitmeli — eksikse yine 404, ve 404
"model yok" gibi okunduğu için yanlış yerde aranıyor.

**55. `DefaultAzureCredential` sunucusuzda çalışmıyor.** Yerelde `az login`
oturumunu bulduğu için "çalışıyor" sanılıyor; Vercel'de ne CLI oturumu ne
yönetilen kimlik var. Üretim için ya kaynak anahtarı ya da uygulama kaydı
(tenant/client/secret) gerekiyor — bu ikisi ortam değişkeni olduğu için her
yerde aynı çalışıyor.

## Para birimi

**56. Tek para birimi varsayımı toplamı sessizce bozuyor.** Rapor "ilk
ekipmanın birimi" ile bütün toplamı yazıyordu; envantere bir USD kalem girince
dolarla lirayı toplayıp sonuca ₺ koymaya başlıyor. Sayı yanlış olduğu belli
olmuyor, çünkü biçim doğru. **Çözüm:** toplamlar para birimine göre gruplanıyor
ve birden çoksa raporun kapsam notuna "kur çevirisi yapılmadı" düşüyor. Kur
çevirisi yapmak da yanlış olurdu: kur alış anına ait, bugünkü kurla çevrilen
tutar sigortaya verilen belgede uydurma bir sayı olur.

**57. İki alanlı satıcı, boş listede çıkmaza sokuyor.** "Satıcı" açılır listesi
ve altında "Yeni satıcı" kutusu vardı; yeni bir lokasyonda liste boş olduğu için
kullanıcı "nereden dolduracağım?" diye takılıyordu. Alan tek: satıcı varsa liste
(sonunda "+ Yeni satıcı…"), yoksa doğrudan ad kutusu.

## Kamera

**58. Varsayılan kamera çözünürlüğü gerçek etiketi okutmuyor.** `getUserMedia`
kısıtsız çağrıldığında 640×480 veriyor; üstüne kareyi 640 piksele indirip tüm
sahneyi çözümlemeye verince ürünün üstündeki küçük barkod birkaç piksele
düşüyor ve hiçbir okuyucu çözemiyor. Sahte kamerayla (kare boyu barkod) test
geçtiği için sorun ancak gerçek üründe görülüyor. **Çözüm üç parçalı:**
(1) `width/height: {ideal: 1920/1080}` ve `focusMode: continuous` isteniyor,
(2) çözümleme tüm kare yerine kullanıcının gördüğü pencereye kırpılıyor,
(3) yakınlaştırma pencereyi daraltıyor — sürücü `zoom` kısıtını desteklemiyorsa
(iOS Safari desteklemiyor) kırpma zaten aynı işi görüyor.

Ayrıca `tryHarder: false` yalnız kusursuz üretilmiş görüntülerde yeterliydi;
gerçek etikette eğrilik ve parlama var, `tryHarder`/`tryRotate`/`tryInvert`
açık olmalı. Biçim listesini daraltmak da okumayı kaçırıyordu: kullanıcı hangi
kodu okutacağını önceden bilmiyor, `AllReadable` doğru varsayılan.

**59. Işık (torch) iOS'ta yok.** `MediaStreamTrack.applyConstraints({torch})`
Chrome/Android'de çalışıyor, iOS Safari'de yok — WebKit tabanlı olduğu için
iPhone'daki tüm tarayıcılarda yok. Düğme `getCapabilities().torch` varsa
gösteriliyor; olmayan yerde hiç çizilmiyor. Çalışmayan bir düğme, olmayan
düğmeden kötü.

## Panel ve yönlendirme

**60. Panel kapanırken yapılan adres değişikliği geri alınıyor.** Filtre paneli
`router.replace(...)` deyip hemen kapanıyordu; panelin geçmiş kaydı
`history.back()` ile düşürülünce adres eski hâline dönüyor ve filtre hiç
uygulanmamış görünüyordu. Aynı tuzağın yenileme hâli #49'da yaşanmıştı. Kural
tek: **panelin işi kapanış tamamlandıktan sonra yapılır** — `useCloseThen`
(kapat, popstate'i bekle, sonra çalıştır).

## Yapılandırma (devam)

**61. Tailwind taranmayan dosyadaki sınıfı siliyor.** `content` listesinde
yalnız `src/app` ve `src/components` vardı; başlık puntosunu seçen saf modül
`src/lib`'de olduğu için ürettiği `text-title`, `line-clamp-2` gibi sınıflar
üretim CSS'ine hiç girmedi. Hata görünmüyor: sınıf HTML'de duruyor, karşılığı
yok, her şey varsayılan puntoda çiziliyor. Sınıf adı üreten her dosya `content`
listesinde olmalı.

## Test yazarken

**62. `text=` metin alanının içeriğine de eşleşiyor.** "Notu kaydettim, ekranda
görünsün" beklemesi (`waitForSelector("text=<not>")`), panel hâlâ açıkken
`textarea`'nın içindeki aynı metne eşleşip anında dönüyordu; fotoğraf yüklenirken
kontroller erken koşuyor ve "fotoğraf yok" diye patlıyordu. Kayıt sonrası
beklemesi **panelin kapanması** olmalı (`div[role="dialog"]` → `detached`),
metnin görünmesi değil.

## Liste satırı

**63. Satırın yatay boşluğu üstteki kaptaydı; kaydırma paneli oradan sızıyordu.**
`Rows` her çocuğa `pl-4` veriyordu. Mutlak konumlu işlem paneli bu boşluğun da
üstüne düşüyor, hareket eden yüzey ise boşluktan sonra başlıyor — kapalı
satırda bile soldan mavi bir şerit görünüyordu. Karanlık temada iyice göze
batıyor. **Kural:** kaydırma jestli satır kenardan kenara olmalı; yatay boşluk
satırın kendi içinde (`Row`'un gövdesinde), kapta değil.

**64. Bağlantının içindeki düğme dokunuşu yutturuyor.** Listedeki küçük görsel
satır bağlantısının içindeydi; üstüne düğme koyunca hem geçersiz biçimlendirme
(`<a>` içinde `<button>`) oluyor hem dokunuş satırı açıyordu. Görsel artık
bağlantının dışında, `Row` iki parça çiziyor: solda görsel, yanında bağlantı.

## Kamera (devam)

**65. Okuma penceresi kullanıcının gördüğü yer değildi.** Çerçeve kutuya göre
çiziliyordu ama çözümleme videoya göre kırpıyordu. Video yatay (1920×1080),
kutu dikey (390×520) ve `object-cover` kenarlardan kırpıyor: kullanıcının
gördüğü alan karenin dar bir dikey dilimi. "Yüzde 86 genişlik, yüzde 50
yükseklik" iki dünyada bambaşka iki dikdörtgen demek. Sonuç: çerçeveye alınan
kod çözümlemeye hiç girmiyordu.

Üstüne pencere geniş ve kısaydı. Çizgi barkod tek bir yatay dilimden çözülüyor,
ama QR ve Data Matrix'in **tamamı** çerçeveye girmeli — geniş/kısa pencere 2B
kodların üstünü altını kesiyordu. Bu yüzden çizgi barkod okunurken QR
okunmuyordu. **Çözüm:** pencere kutu üzerinden hesaplanıp `object-cover`
dönüşümüyle video pikseline çevriliyor (`src/lib/camera-window.ts`, testli) ve
kare biçiminde — kare pencere çizgi barkodu da kesiyor, 2B kodu da tamamıyla
alıyor.

**66. Esneyen satırda sabit boyutlu görsel metnin üstüne biniyor.** Başlıktaki
64 piksellik fotoğraf bir düğmenin içindeydi; düğmenin `flex-shrink`'i açık
olduğu için satır daralınca düğme küçülüyor ama içindeki görsel küçülmüyor ve
taşan kısım yanındaki başlığın ilk harflerini örtüyordu. Arka planı sayfayla
aynı renk olduğu için "kırpılmış yazı" gibi görünüyor, hangi öğenin örttüğü
belli olmuyordu (`elementFromPoint` söyledi). Esnek satırdaki sabit boyutlu her
öğe `shrink-0` olmalı.


**67. "QR okunmuyor" sanılan şey aslında okunuyordu.** Kullanıcı gerçek bir
ürün etiketinin fotoğrafını gönderdi: parlak gümüş sticker, yan yatmış QR.
Refleks, çözümleyiciyi kurcalamaktı — binarizer, `tryHarder`, parlama. Önce
ölçtük: aynı fotoğraf Node'da zxing ile **ilk denemede**, `tryHarder` bile
kapalıyken çözüldü. Sorun kamerada değil, çözülen metnin sonrasındaydı:

    http://www.registeryourshark.com/reg/?m=FA300EU&s=A20XX712Z1Q1

`serialFromScan` bunu "adres" sayıp geri çeviriyordu, çünkü tanıdığı parametre
adları `sn`/`serial` ile başlıyordu; kayıt adresleri ise tek harf kullanıyor
(`s`, `m`). Kullanıcıya bu, "QR algılanmıyor" diye görünüyordu.

İki ders: (1) "okumuyor" şikâyetinde önce **hangi aşamada** düştüğünü ölç —
kamera, çözümleme ve yorumlama ayrı üç aşama; (2) tek harfli parametre adı tek
başına kanıt değil (`?s=` çoğu sitede arama), o yüzden `s`/`sno` yalnız değeri
seri noya benziyorsa (boşluksuz, en az bir rakam, 5–32 karakter) kabul ediliyor.
Aynı QR modeli de taşıdığı için model alanı — boşsa — o değerle doluyor.

Node'da zxing'i çalıştırmanın yolu `tests/e2e/sahte/y4m.mjs` içindeki
`instantiateWasm` numarası; `readBarcodes` ham JPEG baytlarını da alıyor, tuval
gerekmiyor.

## Katlanır bölümler ve katmanlar

**68. Dönüşümlü atanın içindeki `position: fixed` tam ekran olmuyor.** Liste
satırı kaydırma jesti için `transform: translate3d(...)` taşıyor. Dönüşüm
uygulanmış bir öğe, içindeki `fixed` konumlu her şey için yeni bir kapsayıcı
blok oluşturuyor: `inset-0` artık ekranı değil o satırın kutusunu kaplıyor.
Satırdaki fotoğrafa dokununca görsel görüntüleyici açılıyor ama 64 piksellik
bir şeride sıkışıp görünmez oluyordu (Playwright "hidden" diyordu, DOM'da
vardı). **Çözüm:** görüntüleyici `createPortal` ile `document.body`'ye
basılıyor. Tam ekran her katman için kural: satır içinde doğan bir katman
gövdeye taşınmalı.

**69. `<details open={...}>` her render'da geri yazılıyor.** Katlanır bölümü
kullanıcı açıyor, `router.refresh()` sonrası kapanıyordu — React `open`
özniteliğini kendi bildiği değere döndürüyor. Daha kötüsü: `open`u içeriğe
bağlamak (zimmet varsa açık) kullanıcı iade alınca bölümü kendiliğinden
katlıyordu. **Çözüm:** `open` özniteliği hiç verilmiyor. React değişmeyen
özniteliğe dokunmuyor, açık/kapalı tarayıcıda yaşıyor.

**70. Kapalı bölüm testte "yok" demek değil.** `<details>` kapalıyken içeriği
`display: none`; `waitForSelector` "var ama görünmez" diye bekliyor,
`innerText` içeriği hiç görmüyor, `locator.count()` ise **sayıyor**. Uçtan uca
testte bölümü önce açmak gerekiyor (`bolumAc`, tests/e2e/ortak.mjs) — ve
gezinmeden hemen sonra açmaya kalkarsan eski sayfanın başlığına dokunup yeni
sayfayı kapalı bırakıyorsun; önce yeni sayfayı bekle.
