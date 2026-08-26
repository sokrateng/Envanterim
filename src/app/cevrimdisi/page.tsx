export const metadata = { title: "Çevrimdışı — Envanterim" };

/**
 * Ağ yokken service worker'ın gösterdiği sayfa. Oturum istemiyor: çevrimdışı
 * kimlik doğrulanamaz, o yüzden bu sayfa (uygulama) grubunun dışında.
 */
export default function CevrimdisiPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6 text-center">
      <h1 className="text-large-title">Bağlantı yok</h1>
      <p className="pt-2 text-body text-muted">
        Daha önce açtığın sayfalar çevrimdışı da görünür. Bu sayfa henüz
        açılmamış ya da veri sunucudan gelmesi gereken bir yer.
      </p>
      <p className="pt-4 text-footnote text-muted">
        Bağlantı gelince yenile. Kayıt ekleme, fotoğraf yükleme ve bildirim
        ayarları çevrimdışı çalışmaz.
      </p>
    </main>
  );
}
