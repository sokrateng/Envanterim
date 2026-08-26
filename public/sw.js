/**
 * Bildirim service worker'ı. Yalnız push almak ve tıklamayı yönlendirmek
 * için var — önbellekleme yok, çevrimdışı iddiası yok.
 */
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
