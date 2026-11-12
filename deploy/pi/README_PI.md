# Envanterim: Raspberry Pi kurulumu

Uygulama tek süreç olarak Pi'de çalışır; veritabanı tek dosyalık SQLite
(`data/envanterim.db`), yüklenen dosyalar `.uploads/` altında. İnternete
Tailscale Funnel ile `https://enginc.tailaaa11e.ts.net:8443` adresinden açılır;
kök yol (`/`) kamera paneline aittir ve değişmez.

## Gerekenler

- Raspberry Pi OS / Debian 64-bit, Node 20+, `git`, `curl`, `openssl`, `python3`.
- Tailscale Funnel açık (kamera paneli için zaten açık).

## İlk kurulum

Proje dosyaları `/home/enginc/envanterim` altında olmalı, sonra:

```bash
cd /home/enginc/envanterim
bash deploy/pi/install.sh
```

Betik: bağımlılıkları kurar, `.env` oluşturup sırları (`NEXTAUTH_SECRET`,
`CRON_SECRET`, VAPID) üretir, göçleri uygular, derler, systemd servisini ve
günlük zamanlayıcıyı kurar. `sudo` parolası gerekir.

Sonra elle:

```bash
npm run create-admin                              # ilk hesap
sudo tailscale funnel --bg --https=8443 3000      # internete aç
```

`.env` içinde `VAPID_SUBJECT` (bir e-posta) ve isteğe bağlı SMTP / model
anahtarlarını kendiniz girin; sır değerleri sohbete ya da depoya yazılmaz.
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` derleme sırasında koda gömülür: sonradan
değiştirirseniz yeniden derleyin (`update.sh`).

## Günlük işler

| İş | Komut |
|---|---|
| Durum / kayıt | `systemctl status envanterim` · `journalctl -u envanterim -n 50` |
| Güncelleme | `bash deploy/pi/update.sh` (yedek alır, derler, yeniden başlatır) |
| Yedek | `bash deploy/pi/backup.sh` (60 günden eskiler silinir, en yeni 3 hep kalır; `~/envanterim-yedek/`) |
| Yedek durumu | Uygulamada **Hesap → Sistem** (yönetici hesabıyla); `~/envanterim-yedek/durum.json` ve `yedek.log` |
| Haftalık yedek (cron, pazar gecesi) | `(crontab -l 2>/dev/null; echo "30 3 * * 1 /bin/bash /home/enginc/envanterim/deploy/pi/backup.sh >> /home/enginc/envanterim-yedek/yedek.log 2>&1") \| crontab -` |
| Hatırlatma zamanlayıcısı | `systemctl list-timers envanterim-cron.timer` |
| Hatırlatmayı elle tetikle | `sudo systemctl start envanterim-cron.service` |

## Bilinmesi gerekenler

- **Bellek:** servis `MemoryHigh=450M`, `MemoryMax=700M` ile sınırlı; kamera
  paneli ve YOLO analizi aynı makinede.
- **Derleme:** `next build` birkaç dakika sürer ve bellek ister; sırasında
  kamera analizi yavaşlayabilir.
- **Giriş sınırı:** aynı kullanıcı + adres için 15 dakikada 5 yanlış deneme
  kilitler. Sayaçlar bellektedir, servis yeniden başlayınca sıfırlanır.
- **Arama:** SQLite'ta büyük/küçük harf duyarsız arama yalnız ASCII harflerde
  çalışır (`ş`, `ğ`, `ı`, `İ`… yazımı aynı olmalı).
- **Yedek ve SD kart:** yedekler aynı SD karttadır. Düzenli olarak başka bir
  yere (bilgisayar, USB bellek) kopyalayın.
- **USB belleğe geçiş:** `.env` içindeki `DATABASE_URL` yolunu değiştirip
  `data/` ve `.uploads/` klasörlerini taşımak yeter.
