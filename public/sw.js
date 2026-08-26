/**
 * Service worker: bildirim + çevrimdışı.
 *
 * Çevrimdışı kural basit tutuldu, çünkü sayfaların çoğu oturuma bağlı ve
 * sunucuda üretiliyor:
 * - Gezinme istekleri **önce ağdan**; ağ yoksa o adresin son kopyası, o da
 *   yoksa /cevrimdisi.
 * - Statik dosyalar (`/_next/static`, ikonlar, wasm) içerik adresli, bu yüzden
 *   önce önbellekten.
 * - `/api/*` **hiç** önbelleğe girmiyor: yetkiyle gelen veri ve yazma
 *   istekleri eski kopyayla karşılanmaz.
 *
 * Önbellekte oturum açmış kullanıcının gördüğü HTML duruyor; çıkışta
 * temizleniyor (bkz. SignOutButton).
 */
const SURUM = "envanterim-v1";
const CEVRIMDISI = "/cevrimdisi";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SURUM);
      // Yalnız oturum istemeyen sayfa: kurulum anında kimlik yok.
      await cache.addAll([CEVRIMDISI, "/icon-192.png"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const adlar = await caches.keys();
      await Promise.all(adlar.filter((ad) => ad !== SURUM).map((ad) => caches.delete(ad)));
      await self.clients.claim();
    })(),
  );
});

function staticMi(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/zxing/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const yanit = await fetch(request);
          // Yalnız başarılı ve tam yanıt saklanır; yönlendirme kopyası
          // çevrimdışıyken kullanıcıyı girişe atardı.
          if (yanit.ok && yanit.type === "basic") {
            const cache = await caches.open(SURUM);
            cache.put(request, yanit.clone());
          }
          return yanit;
        } catch {
          const cache = await caches.open(SURUM);
          return (await cache.match(request)) ?? (await cache.match(CEVRIMDISI));
        }
      })(),
    );
    return;
  }

  // App Router istemci gezinmesi HTML değil RSC yükü çekiyor; onu da
  // saklamazsak uygulama içinde tıklayarak gezilen sayfalar çevrimdışı hiç
  // açılmıyor. Anahtar `_rsc` parametresi zaten yönlendirici durumunu
  // kodluyor, bu yüzden adres başına ayrı kayıt oluyor.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SURUM);
        try {
          const yanit = await fetch(request);
          if (yanit.ok) cache.put(request, yanit.clone());
          return yanit;
        } catch (hata) {
          const kopya = await cache.match(request, { ignoreVary: true });
          if (kopya) return kopya;
          throw hata;
        }
      })(),
    );
    return;
  }

  if (staticMi(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SURUM);
        const kopya = await cache.match(request);
        if (kopya) return kopya;

        const yanit = await fetch(request);
        if (yanit.ok) cache.put(request, yanit.clone());
        return yanit;
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Envanterim", body: event.data.text(), url: "/" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Envanterim", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Aynı uyarı iki kez düşerse üst üste yığılmasın.
      tag: payload.tag,
      renotify: false,
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hedef = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const pencereler = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Uygulama zaten açıksa yeni sekme açma, mevcut pencereyi kullan.
      for (const pencere of pencereler) {
        if ("focus" in pencere) {
          await pencere.focus();
          if ("navigate" in pencere) await pencere.navigate(hedef);
          return;
        }
      }
      await self.clients.openWindow(hedef);
    })(),
  );
});

// Çıkışta önbellek temizlensin: ortak cihazda başkasının envanteri kalmasın.
self.addEventListener("message", (event) => {
  if (event.data !== "temizle") return;
  event.waitUntil(caches.keys().then((adlar) => Promise.all(adlar.map((ad) => caches.delete(ad)))));
});
